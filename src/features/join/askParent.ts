import { supabase } from '@/lib/supabase';

/**
 * A child's phone asking its parent to let it join (the `ask-family` edge
 * function). The open request is kept on the phone, so closing the app while
 * it waits picks the wait up again.
 */
export type AskRequest = { id: string; secret: string; match: string; expires_at: string };
export type AskResult = { ok: true; request: AskRequest } | { ok: false; error: 'too_many' | 'blocked' | 'connection' };
export type AskStatus = { state: 'pending' | 'declined' | 'expired' | 'connection' } | { state: 'allowed'; email: string; password: string };

const REQUEST_KEY = 'payhas.askRequest';
const INSTALL_KEY = 'payhas.installId';

/** A random id for this install: the server's per-phone limits count by it. */
function installId(): string {
  let id = localStorage.getItem(INSTALL_KEY);
  if (!id) {
    id = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    localStorage.setItem(INSTALL_KEY, id);
  }
  return id;
}

export function storedRequest(): AskRequest | null {
  try {
    const raw = localStorage.getItem(REQUEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearRequest() {
  localStorage.removeItem(REQUEST_KEY);
}

export async function askParent(phone: string, name: string): Promise<AskResult> {
  const { data, error } = await supabase.functions.invoke('ask-family', { body: { action: 'ask', phone, name, install: installId() } });
  if (error) {
    // A non-2xx reply carries the reason in its body.
    const reason = 'context' in error ? await (error.context as Response).json().then((b) => b?.error).catch(() => null) : null;
    return { ok: false, error: reason === 'too_many' || reason === 'blocked' ? reason : 'connection' };
  }
  const request = data as AskRequest;
  localStorage.setItem(REQUEST_KEY, JSON.stringify(request));
  return { ok: true, request };
}

export async function askStatus(request: AskRequest): Promise<AskStatus> {
  const { data, error } = await supabase.functions.invoke('ask-family', { body: { action: 'status', id: request.id, secret: request.secret } });
  if (error || !data?.state) return { state: 'connection' };
  return data as AskStatus;
}
