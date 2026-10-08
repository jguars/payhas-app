import { useCallback, useEffect, useState } from 'react';

import { deviceTimeZone } from '@/features/library/LibraryProvider';
import type { Lane } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';

export type DayRow = { day: string; video_s: number; game_s: number };
export type TopicRow = { slug: string; label: string; emoji: string; seconds: number };
export type RecentRow = {
  id: string;
  caption: string;
  creator_name: string;
  lane: Lane;
  asset_key: string | null;
  storage_path: string | null;
  thumb_path: string | null;
  seconds: number;
  last_at: string;
  hidden: boolean;
};
export type FlagRow = { video_id: string; caption: string; reason: string; at: string };
export type Child = {
  id: string;
  display_name: string;
  lane: Lane;
  daily_limit_minutes: number | null;
  quiet_hours: boolean;
  bedtime_hour: number;
  wake_hour: number;
  games_enabled: boolean;
  paused: boolean;
  extra_minutes: number;
  last_seen_at: string | null;
  last_activity: 'watching' | 'playing' | 'browsing' | null;
  /** An open "Ask for more time" from the child's stop screen. */
  request: { id: string; created_at: string } | null;
  week: DayRow[];
  topics: TopicRow[];
  recent: RecentRow[];
  flags: FlagRow[];
};
export type Controls = Pick<Child, 'daily_limit_minutes' | 'quiet_hours' | 'bedtime_hour' | 'wake_hour' | 'games_enabled'>;

const POLL_MS = 20_000;

// The parent session lives in memory only: closing the app locks the dashboard.
let parent: { token: string; expires: number } | null = null;
const valid = () => (parent && parent.expires > Date.now() ? parent.token : null);

const expired = (e: { code?: string } | null) => e?.code === '42501';

/** Local midnight — extra time lasts until the end of the child's day. */
const endOfToday = () => {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
};

/** Parent PIN gate + the family dashboard, with optimistic remote controls. */
export function useParent() {
  const [token, setToken] = useState(valid);
  const [children, setChildren] = useState<Child[] | null>(null);

  const lock = useCallback(() => {
    if (parent) supabase.rpc('end_parent_session', { p_parent: parent.token }).then(() => {});
    parent = null;
    setToken(null);
    setChildren(null);
  }, []);

  const unlock = useCallback(async (pin: string) => {
    const { data, error } = await supabase.rpc('start_parent_session', { p_pin: pin });
    if (error) return error.message;
    if (!data) return false;
    parent = { token: data, expires: Date.now() + 14.5 * 60_000 };
    setToken(data);
    return true;
  }, []);

  const load = useCallback(async () => {
    const t = valid();
    if (!t) return setToken(null);
    const { data, error } = await supabase.rpc('get_family_dashboard', { p_parent: t, p_tz: deviceTimeZone() });
    if (expired(error)) return lock();
    if (data) setChildren((data as { profiles: Child[] }).profiles);
  }, [lock]);

  // Live status: refetch every 20s while unlocked; the session runs out by itself.
  useEffect(() => {
    if (!token) return;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [token, load]);

  const patch = (id: string, change: Partial<Child>) =>
    setChildren((list) => list?.map((c) => (c.id === id ? { ...c, ...change } : c)) ?? list);

  /** Runs an RPC after an optimistic patch; reverts and resolves false if it fails. */
  const act = useCallback(
    async (id: string, change: Partial<Child>, call: (t: string) => PromiseLike<{ error: { code?: string } | null }>) => {
      const t = valid();
      if (!t) {
        setToken(null);
        return false;
      }
      const before = children?.find((c) => c.id === id);
      patch(id, change);
      const { error } = await call(t);
      if (error) {
        if (expired(error)) lock();
        else if (before) patch(id, before);
        return false;
      }
      return true;
    },
    [children, lock],
  );

  const setControls = (c: Child, next: Controls) =>
    act(c.id, next, (t) =>
      supabase.rpc('set_profile_controls', {
        p_parent: t,
        p_profile_id: c.id,
        p_daily_limit_minutes: next.daily_limit_minutes,
        p_quiet_hours: next.quiet_hours,
        p_bedtime_hour: next.bedtime_hour,
        p_wake_hour: next.wake_hour,
        p_games_enabled: next.games_enabled,
      }),
    );

  const setPaused = (c: Child, paused: boolean) =>
    act(c.id, { paused }, (t) => supabase.rpc('set_profile_paused', { p_parent: t, p_profile_id: c.id, p_paused: paused }));

  const addTime = (c: Child, minutes: number) =>
    act(c.id, { extra_minutes: Math.min(240, c.extra_minutes + minutes) }, (t) =>
      supabase.rpc('grant_extra_time', { p_parent: t, p_profile_id: c.id, p_minutes: minutes, p_until: endOfToday() }),
    );

  /** Answer "Ask for more time": minutes, or null for "Not today". */
  const answer = (c: Child, minutes: number | null) =>
    act(c.id, { request: null, ...(minutes ? { extra_minutes: Math.min(240, c.extra_minutes + minutes) } : {}) }, (t) =>
      supabase.rpc('answer_time_request', { p_parent: t, p_request_id: c.request!.id, p_minutes: minutes, p_until: endOfToday() }),
    );

  const hideVideo = (c: Child, videoId: string) =>
    act(c.id, { recent: c.recent.map((r) => (r.id === videoId ? { ...r, hidden: true } : r)) }, (t) =>
      supabase.rpc('parent_hide_video', { p_parent: t, p_profile_id: c.id, p_video_id: videoId }),
    );

  return { token, unlocked: !!token, children, unlock, lock, reload: load, setControls, setPaused, addTime, answer, hideVideo };
}

/** "Watching now" if the child's device pinged in the last 2½ minutes. */
export function presence(c: Child, now = Date.now()) {
  if (!c.last_seen_at) return { live: false, text: 'Not seen yet' };
  const ago = now - new Date(c.last_seen_at).getTime();
  if (ago < 150_000) {
    return { live: true, text: c.last_activity === 'watching' ? 'Watching now' : c.last_activity === 'playing' ? 'Playing now' : 'In the app now' };
  }
  const m = Math.round(ago / 60_000);
  return { live: false, text: `Last seen ${m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`} ago` };
}

export const minutes = (s: number) => {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
