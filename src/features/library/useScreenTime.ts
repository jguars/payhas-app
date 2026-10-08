import { useEffect, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';

import { useLibrary } from './LibraryProvider';

export type Lock = 'paused' | 'quiet' | 'limit' | 'games' | null;

/** "8pm", "7am", "12am". */
export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;

/** Quiet hours run from bedtime to wake time, wrapping past midnight when bedtime is later. */
export function inQuietHours(hour: number, bedtime: number, wake: number) {
  return bedtime > wake ? hour >= bedtime || hour < wake : hour >= bedtime && hour < wake;
}

/**
 * Whether the active profile's family controls currently stop playback.
 * Controls arrive live over Realtime (see FamilyProvider), so a parent's
 * pause lands within a second or two. Pass `games` on game screens.
 */
export function useScreenTime(opts: { games?: boolean } = {}): {
  lock: Lock;
  todaySeconds: number;
  limitMinutes: number | null;
  extraMinutes: number;
} {
  const { current } = useFamily();
  const { todaySeconds } = useLibrary();
  const [now, setNow] = useState(() => new Date());

  // Re-check every 30s so quiet hours and expiring extra time apply without a reload.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const extraMinutes = current?.extra_until && new Date(current.extra_until) > now ? current.extra_minutes : 0;
  const base = current?.daily_limit_minutes ?? null;
  const limitMinutes = base == null ? null : base + extraMinutes;
  const quietNow = !!current?.quiet_hours && inQuietHours(now.getHours(), current.bedtime_hour, current.wake_hour);
  const overLimit = limitMinutes != null && todaySeconds >= limitMinutes * 60;
  const gamesOff = !!opts.games && current?.games_enabled === false;

  const lock: Lock = current?.paused ? 'paused' : quietNow ? 'quiet' : overLimit ? 'limit' : gamesOff ? 'games' : null;
  return { lock, todaySeconds, limitMinutes, extraMinutes };
}
