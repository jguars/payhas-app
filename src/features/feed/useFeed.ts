import { useCallback, useEffect, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { useLibrary } from '@/features/library/LibraryProvider';
import { supabase } from '@/lib/supabase';

import { FeedVideo, toFeedVideos } from './data';

export type FeedMode = 'forYou' | 'following';

/**
 * The feed for the active profile. Lane filtering happens server-side in
 * get_feed()/get_following_feed(); videos marked "Not interested" this
 * session drop out locally straight away.
 */
export function useFeed(mode: FeedMode = 'forYou') {
  const { active, leaveProfile } = useFamily();
  const { hidden, following } = useLibrary();
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);

  // Following refetches when the follow list changes, so a new follow shows up.
  const followKey = mode === 'following' ? [...following].sort().join('|') : '';

  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    const { data, error } =
      mode === 'following'
        ? await supabase.rpc('get_following_feed', { p_session: active.token })
        : await supabase.rpc('get_feed', { p_session: active.token });
    // Stale or revoked session (e.g. the lane changed) → back to "Who's watching?".
    if (error) {
      setLoading(false);
      return leaveProfile();
    }
    setVideos(await toFeedVideos(data));
    setLoading(false);
  }, [active, mode, leaveProfile]);

  useEffect(() => {
    load();
  }, [load, followKey]);

  return { videos: videos.filter((v) => !hidden.has(v.id)), loading, reload: load };
}
