import { useCallback, useEffect, useState } from 'react';

import { deviceTimeZone } from '@/features/library/LibraryProvider';
import type { T } from '@/i18n';
import type { Lane } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';

export type DayRow = { day: string; video_s: number; game_s: number };
export type TopicRow = { slug: string; label: string; emoji: string; seconds: number };
export type RecentRow = {
  id: string;
  caption: string;
  caption_i18n?: unknown;
  creator_name: string;
  lane: Lane;
  asset_key: string | null;
  storage_path: string | null;
  thumb_path: string | null;
  seconds: number;
  last_at: string;
  hidden: boolean;
};
export type FlagRow = { video_id: string; caption: string; caption_i18n?: unknown; reason: string; at: string };
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

/** The dashboard's open parent session, if any, so a screen opened from it (Payhas Plus) needn't ask for the PIN again. */
export const currentParentToken = valid;

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
  /** Whether the family is on Plus (the server trims history on Free). Null before the first load. */
  const [plus, setPlus] = useState<boolean | null>(null);

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
    if (data) {
      const d = data as { profiles: Child[]; plus?: boolean };
      setChildren(d.profiles);
      setPlus(d.plus ?? null);
    }
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

  return { token, unlocked: !!token, children, plus, unlock, lock, reload: load, setControls, setPaused, addTime, answer, hideVideo };
}

/** "5m ago", "2h ago", "3d ago" in the current language. */
export function ago(t: T, minutes: number) {
  const m = Math.max(1, minutes);
  return m < 60
    ? t('parent.agoMin', { count: m })
    : m < 1440
      ? t('parent.agoHour', { count: Math.round(m / 60) })
      : t('parent.agoDay', { count: Math.round(m / 1440) });
}

/** "Watching now" if the child's device pinged in the last 2½ minutes. */
export function presence(c: Child, t: T, now = Date.now()) {
  if (!c.last_seen_at) return { live: false, text: t('parent.notSeen') };
  const since = now - new Date(c.last_seen_at).getTime();
  if (since < 150_000) {
    return {
      live: true,
      text: t(c.last_activity === 'watching' ? 'parent.watchingNow' : c.last_activity === 'playing' ? 'parent.playingNow' : 'parent.inAppNow'),
    };
  }
  return { live: false, text: t('parent.lastSeen', { time: ago(t, Math.round(since / 60_000)) }) };
}

/** Seconds as "1h 5m" / "45m" (in the current language). */
export const minutes = (t: T, s: number) => {
  const m = Math.round(s / 60);
  return m >= 60 ? t('parent.durHM', { h: Math.floor(m / 60), m: m % 60 }) : t('parent.durM', { m });
};
