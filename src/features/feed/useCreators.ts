import { useCallback, useEffect, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { useUsage } from '@/features/library/LibraryProvider';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Creator = Database['public']['Functions']['get_creators']['Returns'][number];

/** Creators this profile may see (only those with lane-allowed videos), refreshed when follows change. */
export function useCreators(onlyFollowing = false) {
  const { active } = useFamily();
  const { version } = useUsage();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!active) return;
    const { data, error } = await supabase.rpc('get_creators', { p_session: active.token, p_only_following: onlyFollowing });
    if (error) console.warn('get_creators', error.message);
    setCreators(data ?? []);
    setLoading(false);
  }, [active, onlyFollowing]);

  useEffect(() => {
    load();
  }, [load, version]);

  return { creators, loading };
}
