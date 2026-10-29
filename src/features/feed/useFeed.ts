import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';

import { useFamily } from '@/features/family/FamilyProvider';
import { useLibrary } from '@/features/library/LibraryProvider';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';

import { FeedVideo, toFeedVideos } from './data';

export type FeedMode = 'forYou' | 'following';

// Small pages, so what the profile just did (finished, skipped) shapes the next one.
const PAGE = 6;

/**
 * The feed for the active profile. For You is ranked per profile on the
 * server (picked interests blended with what the profile finishes, likes and
 * skips, clip quality in its lane, follows, freshness, an exploration slot —
 * see get_for_you) and pages by excluding what's already loaded; Following
 * is newest-first from followed channels. Lane filtering is server-side;
 * videos marked "Not interested" this session drop out locally straight away.
 */
export function useFeed(mode: FeedMode = 'forYou') {
  const { active, leaveProfile } = useFamily();
  const { hidden, following } = useLibrary();
  const { lang } = useT();
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const busy = useRef(false);

  // Following refetches when the follow list changes, so a new follow shows up.
  const followKey = mode === 'following' ? [...following].sort().join('|') : '';

  const fetchPage = useCallback(
    async (exclude: string[]) => {
      if (!active) return null;
      const { data, error } =
        mode === 'following'
          ? await supabase.rpc('get_following_feed', { p_session: active.token })
          : await supabase.rpc('get_for_you', { p_session: active.token, p_limit: PAGE, p_exclude: exclude });
      // Stale or revoked session (e.g. the lane changed) → back to "Who's watching?".
      if (error) {
        leaveProfile();
        return null;
      }
      const page = await toFeedVideos(data, lang);
      // Posters back the blurred fill behind each video; fetch them before the videos scroll in.
      for (const v of page) if (typeof v.thumb === 'object') Image.prefetch(v.thumb.uri, 'memory-disk').catch(() => {});
      return page;
    },
    [active, mode, leaveProfile, lang],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const page = await fetchPage([]);
    if (page) {
      setVideos(page);
      setDone(mode === 'following' || page.length < PAGE);
    }
    setLoading(false);
  }, [fetchPage, mode]);

  /** Next page of For You; call near the end of the list. */
  const loadMore = useCallback(async () => {
    if (mode !== 'forYou' || done || busy.current || loading) return;
    busy.current = true;
    const page = await fetchPage(videos.map((v) => v.id));
    if (page) {
      setVideos((cur) => [...cur, ...page.filter((p) => !cur.some((c) => c.id === p.id))]);
      if (page.length < PAGE) setDone(true);
    }
    busy.current = false;
  }, [mode, done, loading, fetchPage, videos]);

  useEffect(() => {
    load();
  }, [load, followKey]);

  /** Put a video (opened from elsewhere) at the top unless it's already loaded. */
  const insert = useCallback((v: FeedVideo) => {
    setVideos((cur) => (cur.some((c) => c.id === v.id) ? cur : [v, ...cur]));
  }, []);

  return { videos: videos.filter((v) => !hidden.has(v.id)), loading, done, reload: load, loadMore, insert };
}
