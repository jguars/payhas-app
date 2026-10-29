import { supabase } from '@/lib/supabase';

/** The family's plan, from get_family_plan. The server enforces every limit; the app only reflects it. */
export type FamilyPlan = {
  plus: boolean;
  plus_until: string | null;
  profile_limit: number;
  profiles: number;
  price_tmt: number;
  /** Card payment is open (simulated while test mode is on). */
  card_payments: boolean;
  /** Test mode: simulated bank payments and the test key work. Off before launch. */
  test_mode?: boolean;
};

export async function fetchFamilyPlan(): Promise<FamilyPlan | null> {
  const { data } = await supabase.rpc('get_family_plan');
  return (data as unknown as FamilyPlan | null) ?? null;
}

export type RedeemResult = { result: 'ok' | 'invalid' | 'used' | 'too_many'; plus_until?: string };

/** Redeem an activation code from a parent session. Null means the session ran out (ask for the PIN again). */
export async function redeemCode(parent: string, code: string): Promise<RedeemResult | null> {
  const { data, error } = await supabase.rpc('redeem_code', { p_parent: parent, p_code: code });
  if (error) return null;
  return data as unknown as RedeemResult;
}

export type Bank = 'halkbank' | 'senagat' | 'rysgal';
export const BANKS: { id: Bank; name: string }[] = [
  { id: 'halkbank', name: 'Halkbank' },
  { id: 'senagat', name: 'Senagat Bank' },
  { id: 'rysgal', name: 'Rysgal Bank' },
];

export type PayResult = { result: 'ok' | 'invalid' | 'unavailable'; plus_until?: string };

/**
 * Pay a month by card through one of the banks. While test mode is on this is
 * a simulation: only the bank's name goes to the server, never card details.
 */
export async function payByCard(parent: string, bank: Bank): Promise<PayResult | null> {
  const { data, error } = await supabase.rpc('simulate_card_payment', { p_parent: parent, p_bank: bank });
  if (error) return null;
  return data as unknown as PayResult;
}

export type TestKeyResult = { result: 'ok' | 'invalid' | 'too_many' | 'unavailable'; plus?: boolean; plus_until?: string | null };

/** Test mode only: the secret test key turns Plus on (a month) or off for this family. */
export async function applyTestKey(parent: string, key: string, on: boolean): Promise<TestKeyResult | null> {
  const { data, error } = await supabase.rpc('simulate_plus', { p_parent: parent, p_key: key, p_on: on });
  if (error) return null;
  return data as unknown as TestKeyResult;
}

/** "29.12.2026": the day a Plus period ends, in the format used across the region. */
export function planDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** "PAYH-7KQ2-M9XD-4TRB" as the parent types: upper case, grouped in fours, the prefix added. */
export function formatCode(input: string) {
  let raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.startsWith('PAYH')) raw = raw.slice(4);
  raw = raw.slice(0, 12);
  const groups = raw.match(/.{1,4}/g) ?? [];
  return raw.length === 0 ? '' : ['PAYH', ...groups].join('-');
}
