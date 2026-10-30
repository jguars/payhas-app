import { useCallback, useEffect, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import type { GameId } from '@/features/library/LibraryProvider';
import { supabase } from '@/lib/supabase';

/** What the active profile may use right now. `games` and `videosLeft` are null on Plus (nothing locked). */
export type ProfilePlan = { plus: boolean; games: GameId[] | null; videosLeft: number | null };

/** The active profile's plan; refetch with `reload` (e.g. when a feed runs dry). */
export function useProfilePlan() {
  const { active } = useFamily();
  const [plan, setPlan] = useState<ProfilePlan | null>(null);
  /** The last load failed (offline, server); the screen can say so and offer a retry. */
  const [failed, setFailed] = useState(false);
  const token = active?.token;

  const reload = useCallback(async () => {
    if (!token) return;
    const { data, error } = await supabase.rpc('get_profile_plan', { p_session: token });
    setFailed(!!error || !data);
    if (!data) return;
    const d = data as unknown as { plus: boolean; games: GameId[] | null; videos_left: number | null };
    setPlan({ plus: d.plus, games: d.games, videosLeft: d.videos_left });
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Nothing counts as open until the plan has loaded: a Free child never sees
  // locked games flash in, and a failed load never unlocks everything.
  return { plan, loaded: plan != null, failed, reload, gameOpen: (id: GameId) => plan != null && (!plan.games || plan.games.includes(id)) };
}
