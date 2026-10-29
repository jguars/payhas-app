import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { FeedVideo, toFeedVideos } from '@/features/feed/data';
import { deviceTimeZone, useLibrary } from '@/features/library/LibraryProvider';
import { useT } from '@/i18n';
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

/**
 * The first few saved videos for the Me tab's poster grid, refetched each
 * time the tab comes into view (same source as the Saved screen).
 */
export function useSavedPreview(max = 9) {
  const { active } = useFamily();
  const { saved } = useLibrary();
  const { lang } = useT();
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const token = active?.token;

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let live = true;
      supabase.rpc('get_saved', { p_session: token }).then(async ({ data }) => {
        const list = await toFeedVideos(data, lang);
        if (!live) return;
        setVideos(list);
        setLoaded(true);
      });
      return () => {
        live = false;
      };
    }, [token, lang]),
  );

  // Unsaving from the feed drops the poster straight away.
  return { videos: videos.filter((v) => saved.has(v.id)).slice(0, max), loaded };
}
