import { useCallback, useEffect, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { deviceTimeZone, useLibrary } from '@/features/library/LibraryProvider';
import { supabase } from '@/lib/supabase';

export type TasteRow = { slug: string; label: string; share: number; picked: boolean };
export type MeData = { today_seconds: number; saved: number; following: number; taste: TasteRow[] };

/** The Me tab's numbers, refetched whenever the library changes. */
export function useMe() {
  const { active } = useFamily();
  const { version } = useLibrary();
  const [data, setData] = useState<MeData | null>(null);
  const token = active?.token;

  const load = useCallback(async () => {
    if (!token) return;
    const { data: me } = await supabase.rpc('get_me', { p_session: token, p_tz: deviceTimeZone() });
    if (me) setData(me as MeData);
  }, [token]);

  useEffect(() => {
    load();
  }, [load, version]);

  const resetTaste = useCallback(async () => {
    if (!token) return;
    await supabase.rpc('reset_taste', { p_session: token });
    await load();
  }, [token, load]);

  return { data, reload: load, resetTaste };
}

/**
 * What the taste card shows: the top three topics by watch share, then the
 * least-watched pick as "exploring" (the engine's gentle nudge), max four rows.
 */
export function tasteRows(taste: TasteRow[]): (TasteRow & { exploring: boolean })[] {
  const watched = taste.filter((t) => t.share > 0);
  const top = watched.slice(0, 3).map((t) => ({ ...t, exploring: false }));
  const explore = taste.filter((t) => t.picked && !top.some((x) => x.slug === t.slug)).sort((a, b) => a.share - b.share)[0];
  return explore ? [...top, { ...explore, exploring: true }] : top;
}
