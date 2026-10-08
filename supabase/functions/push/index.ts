// Sends one queued parent alert (public.push_events) to every opted-in phone
// in the family, via Firebase Cloud Messaging HTTP v1.
//
// Called by pg_net from private.queue_push() with { event_id } only. It reads
// the event with the service role and claims it (sent_at) before sending, so
// a repeated or forged call can't send anything twice or anything made up.
//
// Secret: FIREBASE_SERVICE_ACCOUNT — the service-account JSON from Firebase
// console → Project settings → Service accounts → Generate new private key.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

let cached: { token: string; expires: number } | null = null;

const b64url = (bytes: Uint8Array | string) =>
  btoa(typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

/** OAuth access token for FCM, from a self-signed service-account JWT. Reused for ~55 min. */
async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.expires > Date.now()) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`oauth ${res.status}: ${await res.text()}`);
  const { access_token, expires_in } = await res.json();
  cached = { token: access_token, expires: Date.now() + (expires_in - 300) * 1000 };
  return access_token;
}

Deno.serve(async (req) => {
  const { event_id } = await req.json().catch(() => ({}));
  if (typeof event_id !== 'number') return new Response('bad request', { status: 400 });

  // Claim the event: only the first call for an unsent event gets a row back.
  const { data: ev } = await db
    .from('push_events')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', event_id)
    .is('sent_at', null)
    .select('id, family_id, kind, title, body, data')
    .maybeSingle();
  if (!ev) return new Response('nothing to send');

  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) {
    await db.from('push_events').update({ error: 'FIREBASE_SERVICE_ACCOUNT not set' }).eq('id', ev.id);
    return new Response('not configured', { status: 500 });
  }
  const sa: ServiceAccount = JSON.parse(raw);

  const { data: devices } = await db.from('push_devices').select('token').eq('family_id', ev.family_id);
  const errors: string[] = [];
  try {
    const token = await accessToken(sa);
    // FCM data values must be strings.
    const data = Object.fromEntries(Object.entries({ kind: ev.kind, ...(ev.data ?? {}) }).map(([k, v]) => [k, String(v)]));
    for (const d of devices ?? []) {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: d.token,
            notification: { title: ev.title, body: ev.body },
            data,
            android: {
              priority: 'high',
              notification: { channel_id: 'parent', tag: `${ev.kind}:${data.profile_id ?? ''}` },
            },
          },
        }),
      });
      if (res.ok) continue;
      const text = await res.text();
      // The app was uninstalled or the token rotated: forget this phone.
      if (res.status === 404 || text.includes('UNREGISTERED')) {
        await db.from('push_devices').delete().eq('token', d.token);
      } else {
        errors.push(`${res.status}: ${text.slice(0, 300)}`);
      }
    }
  } catch (e) {
    errors.push(String(e));
  }
  if (errors.length) await db.from('push_events').update({ error: errors.join('\n') }).eq('id', ev.id);
  return new Response(errors.length ? 'partial' : 'ok');
});
