import { useEffect, useMemo, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { FeedVideo } from '@/features/feed/data';
import { useFeed } from '@/features/feed/useFeed';
import { Constants, Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Topic = Tables<'interests'> & { picked: boolean; count: number };
export type Channel = { name: string; videos: FeedVideo[] };

const laneRank = (l: Tables<'interests'>['youngest_lane']) => Constants.public.Enums.lane.indexOf(l);

/**
 * Everything Discover shows, already lane-gated: videos come from get_feed(),
 * topics are the interests rated for this profile's lane.
 */
export function useDiscover() {
  const { active } = useFamily();
  const { videos, loading } = useFeed();
  const [interests, setInterests] = useState<Tables<'interests'>[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const profile = active?.profile;

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      supabase.from('interests').select('*').order('sort'),
      supabase.from('profile_interests').select('interest_slug').eq('profile_id', profile.id),
    ]).then(([all, mine]) => {
      setInterests((all.data ?? []).filter((i) => laneRank(i.youngest_lane) <= laneRank(profile.lane)));
      setPicked(new Set((mine.data ?? []).map((r) => r.interest_slug)));
    });
  }, [profile]);

  const topics = useMemo<Topic[]>(() => {
    const withCounts = interests.map((i) => ({
      ...i,
      picked: picked.has(i.slug),
      count: videos.filter((v) => v.topics.includes(i.slug)).length,
    }));
    // The profile's own picks first, then whatever has something to watch.
    return withCounts.sort((a, b) => Number(b.picked) - Number(a.picked) || b.count - a.count || a.sort - b.sort);
  }, [interests, picked, videos]);

  // The shelf: the first picked topic that has videos, else the busiest topic.
  const shelf = useMemo(() => {
    const topic = topics.find((t) => t.picked && t.count > 0) ?? topics.find((t) => t.count > 0);
    if (!topic) return null;
    const shelfVideos = videos.filter((v) => v.topics.includes(topic.slug));
    return { topic, videos: shelfVideos };
  }, [topics, videos]);

  // Most watched first, for the Top 10 row.
  const top = useMemo(() => [...videos].sort((a, b) => b.views - a.views).slice(0, 10), [videos]);

  // Shelves per channel: creators with at least two videos, the busiest first.
  const channels = useMemo<Channel[]>(() => {
    const by = new Map<string, FeedVideo[]>();
    for (const v of videos) by.set(v.creator.name, [...(by.get(v.creator.name) ?? []), v]);
    return [...by.entries()]
      .filter(([, vs]) => vs.length >= 2)
      .map(([name, vs]) => ({ name, videos: vs }))
      .sort((a, b) => b.videos.length - a.videos.length || a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [videos]);

  return { profile, videos, topics, shelf, top, channels, loading };
}

/** Caption, creator, topic slug or (when given) the topic's label in the app's language. */
export function matchesQuery(v: FeedVideo, q: string, labelOf?: (slug: string) => string, lang?: string) {
  const lower = (s: string) => (lang ? s.toLocaleLowerCase(lang) : s.toLowerCase());
  const needle = lower(q.trim());
  if (!needle) return true;
  const labels = labelOf ? v.topics.map(labelOf) : [];
  return [v.caption, v.creator.name, ...v.topics, ...labels].some((s) => lower(s).includes(needle));
}
