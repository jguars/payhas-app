import { useEffect, useMemo, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { FeedVideo } from '@/features/feed/data';
import { useFeed } from '@/features/feed/useFeed';
import { Constants, Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Topic = Tables<'interests'> & { picked: boolean; count: number };

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

  return { profile, videos, topics, shelf, loading };
}

export function matchesQuery(v: FeedVideo, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [v.caption, v.creator.name, ...v.topics].some((s) => s.toLowerCase().includes(needle));
}
