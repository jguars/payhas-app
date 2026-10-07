import { useEffect, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';

import { useLibrary } from './LibraryProvider';

/** Quiet hours run overnight, 8pm to 7am device time. */
export const QUIET_START_HOUR = 20;
export const QUIET_END_HOUR = 7;

export type Lock = 'limit' | 'quiet' | null;

/** Whether the active profile's family controls currently stop playback. */
export function useScreenTime(): { lock: Lock; todaySeconds: number; limitMinutes: number | null } {
  const { current } = useFamily();
  const { todaySeconds } = useLibrary();
  const [now, setNow] = useState(() => new Date());

  // Re-check every 30s so quiet hours start without a reload.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const limitMinutes = current?.daily_limit_minutes ?? null;
  const hour = now.getHours();
  const quietNow = !!current?.quiet_hours && (hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR);
  const overLimit = limitMinutes != null && todaySeconds >= limitMinutes * 60;

  return { lock: quietNow ? 'quiet' : overLimit ? 'limit' : null, todaySeconds, limitMinutes };
}
