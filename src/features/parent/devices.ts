import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** One linked phone, as the parent sees it (list_devices). */
export type LinkedPhone = {
  id: string;
  name: string;
  kind: 'child' | 'shared';
  status: 'pending' | 'active';
  profile_id: string | null;
  profile_name: string | null;
  last_seen_at: string | null;
};

export type LinkCode = { id: string; code: string; expires_at: string };
export type LinkState = { state: 'waiting' | 'expired' } | { state: 'joined' | 'allowed'; device: { id: string; name: string } };

/** A fresh 6-digit code for one child's phone, or a shared phone when `profile` is null. */
export async function createLinkCode(parent: string, profile: string | null): Promise<LinkCode | null> {
  const { data, error } = await supabase.rpc('create_link_code', { p_parent: parent, p_profile: profile });
  return error ? null : (data as LinkCode);
}

export async function linkStatus(parent: string, codeId: string): Promise<LinkState | null> {
  const { data, error } = await supabase.rpc('link_code_status', { p_parent: parent, p_code_id: codeId });
  return error ? null : (data as LinkState);
}

/** Allow a phone that joined, or turn it away (it's deleted). */
export async function answerDevice(parent: string, device: string, allow: boolean) {
  const { data, error } = await supabase.rpc('answer_device', { p_parent: parent, p_device: device, p_allow: allow });
  return !error && !!data;
}

/** The family's linked phones, refreshed when the screen asks (after linking, removing). */
export function useLinkedPhones(parent: string | null) {
  const [phones, setPhones] = useState<LinkedPhone[] | null>(null);
  const load = useCallback(async () => {
    if (!parent) return;
    const { data, error } = await supabase.rpc('list_devices', { p_parent: parent });
    if (!error) setPhones((data ?? []) as LinkedPhone[]);
  }, [parent]);
  useEffect(() => {
    load();
  }, [load]);

  const remove = useCallback(
    async (id: string) => {
      if (!parent) return false;
      const { data, error } = await supabase.rpc('remove_device', { p_parent: parent, p_device: id });
      if (!error && data) setPhones((cur) => cur?.filter((p) => p.id !== id) ?? null);
      return !error && !!data;
    },
    [parent],
  );

  return { phones, reload: load, remove };
}
