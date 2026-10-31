// A child's phone asks its parent to let it join (the other way round from
// join-family, where the parent makes a code first).
//
//   { action: 'ask', phone, name, install } → { id, secret, match, expires_at }
//     The parent's number finds the family; their phone gets the request with
//     the same 2-digit match number. An unknown number gets the same reply.
//   { action: 'status', id, secret } → { state: pending | declined | expired }
//     or, once the parent allows it, { state: 'allowed', email, password }:
//     the phone becomes its own user, an allowed child phone, and signs in.
//
// The secret stays on the asking phone; the server keeps only its SHA-256.
// Limits live in public.create_join_request.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const PHONE = /^\+993[0-9]{8}$/;
const UUID = /^[0-9a-f-]{36}$/;

const randomText = (bytes: number) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))));
/** Postgres bytea literal of the secret's SHA-256. */
const hashOf = async (secret: string) =>
  '\\x' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)))].map((b) => b.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'bad_request' });
  }

  if (body.action === 'ask') {
    const { phone, name, install } = body;
    if (typeof phone !== 'string' || !PHONE.test(phone)) return reply(400, { error: 'bad_phone' });
    if (typeof install !== 'string' || install.length < 8 || install.length > 64) return reply(400, { error: 'bad_request' });
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    const secret = randomText(24);
    const { data, error } = await db.rpc('create_join_request', {
      p_phone: phone,
      p_name: typeof name === 'string' ? name : 'Phone',
      p_install: install,
      p_ip: ip,
      p_secret_hash: await hashOf(secret),
    });
    if (error || !data) return reply(500, { error: 'server' });
    if (data.state !== 'ok') return reply(429, { error: data.state });
    return reply(200, { id: data.id, secret, match: data.match, expires_at: data.expires_at });
  }

  if (body.action === 'status') {
    const { id, secret } = body;
    if (typeof id !== 'string' || !UUID.test(id) || typeof secret !== 'string') return reply(400, { error: 'bad_request' });
    const hash = await hashOf(secret);
    const { data, error } = await db.rpc('join_request_status', { p_id: id, p_secret_hash: hash });
    if (error || !data) return reply(500, { error: 'server' });
    // 'claimed': a login was already handed out for this request; it isn't handed out twice.
    if (data.state === 'claimed') return reply(200, { state: 'expired' });
    if (data.state !== 'allowed') return reply(200, { state: data.state });

    const email = `device-${crypto.randomUUID()}@devices.payhas.invalid`;
    const password = randomText(24);
    const { data: created, error: createError } = await db.auth.admin.createUser({ email, email_confirm: true, password });
    if (createError || !created.user) return reply(500, { error: 'server' });
    const { data: claimed, error: claimError } = await db.rpc('claim_join_request', { p_id: id, p_secret_hash: hash, p_user: created.user.id });
    if (claimError || !claimed) {
      await db.auth.admin.deleteUser(created.user.id);
      return reply(claimError ? 500 : 200, claimError ? { error: 'server' } : { state: 'expired' });
    }
    return reply(200, { state: 'allowed', email, password });
  }

  return reply(400, { error: 'bad_request' });
});
