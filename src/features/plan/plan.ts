import { supabase } from '@/lib/supabase';

/** The family's plan, from get_family_plan. The server enforces every limit; the app only reflects it. */
export type FamilyPlan = {
  plus: boolean;
  plus_until: string | null;
  profile_limit: number;
  profiles: number;
  price_tmt: number;
  card_payments: boolean;
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
