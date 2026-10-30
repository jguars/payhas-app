// Phone sign-in: registers a new family or signs an existing one back in by
// its phone number (+993 and 8 digits).
//
// TEST MODE ONLY. There is no SMS yet: the code is the PHONE_TEST_CODE secret
// (0000 while testing), the same for every number. That means anyone who
// knows a family's number can sign in as them, so remove the secret — which
// turns phone sign-in off — before real families use the app, and switch to
// Supabase phone OTP with an SMS provider.
//
// How a session is made without SMS: each phone account is a Supabase user
// with the number on `phone` and an internal alias email; every successful
// code check sets a fresh random password and returns it once, and the app
// signs in with it. The number is also stored on public.families.phone.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const TEST_CODE = Deno.env.get('PHONE_TEST_CODE');
const PHONE = /^\+993[0-9]{8}$/;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Never sent to: `.invalid` is reserved (RFC 2606), and Payhas sends no email to phone accounts. */
const aliasEmail = (phone: string) => `${phone.slice(1)}@phone.payhas.invalid`;

const randomPassword = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes));
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method' });
  if (!TEST_CODE) return reply(503, { error: 'disabled' });

  let phone = '';
  let code = '';
  try {
    ({ phone, code } = await req.json());
  } catch {
    return reply(400, { error: 'bad_request' });
  }
  if (typeof phone !== 'string' || !PHONE.test(phone)) return reply(400, { error: 'bad_phone' });
  if (code !== TEST_CODE) return reply(401, { error: 'bad_code' });

  const password = randomPassword();
  const { data: family, error: findError } = await db.from('families').select('owner_id').eq('phone', phone).maybeSingle();
  if (findError) return reply(500, { error: 'server' });

  if (family) {
    const { error } = await db.auth.admin.updateUserById(family.owner_id, { password });
    if (error) return reply(500, { error: 'server' });
    return reply(200, { email: aliasEmail(phone), password, created: false });
  }

  // New number: the auth user's insert trigger creates the family; then the number goes on it.
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: aliasEmail(phone),
    email_confirm: true,
    phone,
    phone_confirm: true,
    password,
  });
  if (createError || !created.user) return reply(500, { error: 'server' });
  const { error: phoneError } = await db.from('families').update({ phone }).eq('owner_id', created.user.id);
  if (phoneError) {
    await db.auth.admin.deleteUser(created.user.id);
    return reply(500, { error: 'server' });
  }
  return reply(200, { email: aliasEmail(phone), password, created: true });
});
