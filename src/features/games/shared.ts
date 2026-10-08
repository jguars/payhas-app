import { useEffect, useRef } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { GameId, useLibrary } from '@/features/library/LibraryProvider';
import { useScreenTime } from '@/features/library/useScreenTime';
import { Lane } from '@/theme/tokens';

/** Per-lane tuning. Little never fails; older lanes get a clock and a target. */
export const BUBBLES: Record<Lane, { rise: number; every: number; round: number | null; targets: boolean }> = {
  little: { rise: 7000, every: 900, round: null, targets: false },
  kids: { rise: 5600, every: 650, round: 45, targets: true },
  teen: { rise: 4600, every: 520, round: 45, targets: true },
  adult: { rise: 4000, every: 450, round: 45, targets: true },
};

export const MEMORY: Record<Lane, { cols: number; pairs: number; timed: boolean }> = {
  little: { cols: 2, pairs: 2, timed: false },
  kids: { cols: 3, pairs: 6, timed: false },
  teen: { cols: 4, pairs: 8, timed: true },
  adult: { cols: 4, pairs: 8, timed: true },
};

/** Friendly faces for every lane — nothing here needs a lane check. */
export const CRITTERS = ['🐶', '🐱', '🐰', '🐻', '🐼', '🐸', '🦊', '🐥', '🐢', '🐙', '🦁', '🐨'];

/**
 * While a game is open: count its time toward today's screen time (logged
 * when it closes, and every minute so a long session can't dodge the limit),
 * and report the family-controls lock so the game can stop.
 */
export function useGameSession(game: GameId) {
  const { logPlay } = useLibrary();
  const { lock } = useScreenTime({ games: true });
  const since = useRef(Date.now());

  const flush = () => {
    const now = Date.now();
    logPlay(game, (now - since.current) / 1000);
    since.current = now;
  };

  useEffect(() => {
    if (lock) return;
    since.current = Date.now();
    const id = setInterval(flush, 60_000);
    return () => {
      clearInterval(id);
      flush();
    };
  }, [lock]); // eslint-disable-line react-hooks/exhaustive-deps

  return { lock };
}

/** Best scores stay on this device, per profile — never shared outside the family. */
export function useBest(game: GameId, lane: Lane) {
  const { current } = useFamily();
  const key = `payhas.best.${current?.id}.${game}.${lane}`;
  const read = (): number | null => {
    try {
      const v = localStorage.getItem(key);
      return v == null ? null : Number(v);
    } catch {
      return null;
    }
  };
  /** Saves `score` if it beats the best; returns true when it's a new record. */
  const submit = (score: number, lowerIsBetter = false) => {
    const best = read();
    const better = best == null || (lowerIsBetter ? score < best : score > best);
    if (better) {
      try {
        localStorage.setItem(key, String(score));
      } catch {}
    }
    return better;
  };
  return { read, submit };
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
