import type { ComponentType } from 'react';

import type { T, TKey } from '@/i18n';
import type { GameId } from '@/features/library/LibraryProvider';
import type { Lane } from '@/theme/tokens';

/** One game round. Remount (new key) to restart; `onAgain` asks the screen to do that. */
export type GameProps = { lane: Lane; onAgain: () => void };

/** What the Play tab needs to show a game's card. */
export type GameMeta = {
  id: GameId;
  /** i18n key of the game's name. */
  name: TKey;
  /** One short line under the name, tuned to the lane (what you do, round length). */
  sub: (lane: Lane, t: T) => string;
  /** Background of the card's illustrated stage. */
  tint: string;
  /** The card's little animated stage (≈ 170 × 110 in a grid tile). Pauses when `active` is false. */
  Scene: ComponentType<{ active: boolean }>;
  /** How the stored best score reads; omit for games without one. */
  best?: {
    format: (n: number, lane: Lane, t: T) => string;
    /** 1–3 stars for that best. */
    stars: (n: number, lane: Lane) => number;
    /** Lanes that don't keep a score (Little usually). */
    hiddenFor?: Lane[];
  };
};
