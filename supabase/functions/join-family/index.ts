// A new phone joins a family with the 6-digit code from the parent's
// dashboard (private.link_codes: 10 minutes, once). The phone becomes its own
// auth user — never the parent's login — recorded in public.family_devices as
// 'pending' until the parent taps Allow. Returns one-time credentials the app
// signs in with; after that the phone keeps its own Supabase session.
//
// Guessing: 6 digits and a 10-minute life, at most 10 wrong tries per IP per
// 10 minutes (public.claim_link_code), and the parent still has to allow the phone.
//
// A co-parent code also needs the co-parent's own number and its code (the
// PHONE_TEST_CODE secret while there's no SMS — see phone-auth): their account
// is a real phone account, so phone-auth signs them back in later.
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

const TEST_CODE = Deno.env.get('PHONE_TEST_CODE');
const PHONE = /^\+993[0-9]{8}$/;

const randomPassword = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method' });

  let code = '';
  let name = '';
  let phone: string | undefined;
  let otp: string | undefined;
  try {
    ({ code, name, phone, otp } = await req.json());
  } catch {
    return reply(400, { error: 'bad_request' });
  }
  if (typeof code !== 'string' || !/^[0-9]{6}$/.test(code)) return reply(400, { error: 'bad_code' });
  const deviceName = (typeof name === 'string' && name.trim() ? name.trim() : 'Phone').slice(0, 60);

  // Wrong tries are counted per IP inside public.claim_link_code (10 per 10 minutes).
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (phone !== undefined) {
    if (typeof phone !== 'string' || !PHONE.test(phone)) return reply(400, { error: 'bad_phone' });
    if (!TEST_CODE) return reply(503, { error: 'phone_off' });
    if (otp !== TEST_CODE) return reply(401, { error: 'bad_otp' });
  }
  const { data: claim, error: claimError } = await db.rpc('claim_link_code', { p_code: code, p_ip: ip, p_phone: phone ?? null });
  if (claimError || !claim) return reply(500, { error: 'server' });
  if (claim.state === 'too_many') return reply(429, { error: 'too_many' });
  if (claim.state === 'needs_phone') return reply(409, { error: 'needs_phone' });
  if (claim.state === 'phone_taken') return reply(409, { error: 'phone_taken' });
  if (claim.state !== 'ok') return reply(401, { error: 'bad_code' });
  const coparent = claim.kind === 'coparent';

  // A co-parent gets the same alias as a phone account (phone-auth); a phone gets a device alias.
  const email = coparent ? `${phone!.slice(1)}@phone.payhas.invalid` : `device-${crypto.randomUUID()}@devices.payhas.invalid`;
  const password = randomPassword();
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    ...(coparent ? { phone, phone_confirm: true, user_metadata: { joins_family: true } } : {}),
  });
  if (createError || !created.user) return reply(500, { error: 'server' });

  const { error: deviceError } = await db.from('family_devices').insert({
    family_id: claim.family_id,
    user_id: created.user.id,
    profile_id: claim.profile_id,
    kind: coparent ? 'coparent' : claim.profile_id ? 'child' : 'shared',
    phone: coparent ? phone : null,
    name: deviceName,
    code_id: claim.code_id,
  });
  if (deviceError) {
    await db.auth.admin.deleteUser(created.user.id);
    return reply(500, { error: 'server' });
  }
  return reply(200, { email, password });
});
