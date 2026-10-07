import { useEffect, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { supabase } from '@/lib/supabase';

import { FeedVideo, seedFeed } from './data';

/**
 * The feed for the active profile. Lane filtering happens server-side in
 * get_feed(); the client only maps rows onto bundled assets until Phase 3
 * moves video hosting off-device.
 */
export function useFeed() {
  const { active, leaveProfile } = useFamily();
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    supabase.rpc('get_feed', { p_session: active.token }).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      // Stale or revoked session (e.g. the lane changed) → back to "Who's watching?".
      if (error) return leaveProfile();
      setVideos(
        (data ?? []).flatMap((row) => {
          const local = seedFeed.find((v) => v.id === row.asset_key);
          if (!local) return [];
          return [
            {
              ...local,
              id: row.id,
              caption: row.caption,
              lane: row.lane,
              topics: row.topics,
              creator: { name: row.creator_name, verified: row.creator_verified },
            },
          ];
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [active, leaveProfile]);

  return { videos, loading };
}
