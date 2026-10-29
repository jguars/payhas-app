import type { ComponentType } from 'react';

import type { TKey } from '@/i18n';
import type { GameId } from '@/features/library/LibraryProvider';

import { BubblePop } from './BubblePop';
import { bubblesMeta, memoryMeta } from './classics';
import { EchoLights, echoLightsMeta } from './EchoLights';
import { MazeRun, mazeRunMeta } from './MazeRun';
import { MemoryMatch } from './MemoryMatch';
import { OddOneOut, oddOneOutMeta } from './OddOneOut';
import { PopUpPals, popUpPalsMeta } from './PopUpPals';
import { QuickCount, quickCountMeta } from './QuickCount';
import { SlidePuzzle, slidePuzzleMeta } from './SlidePuzzle';
import { StarCatcher, starCatcherMeta } from './StarCatcher';
import { ThreeInARow, threeInARowMeta } from './ThreeInARow';
import type { GameMeta, GameProps } from './types';

export type GameEntry = { meta: GameMeta; Component: ComponentType<GameProps> };

export const GAMES: Record<GameId, GameEntry> = {
  bubbles: { meta: bubblesMeta, Component: BubblePop },
  moles: { meta: popUpPalsMeta, Component: PopUpPals },
  catch: { meta: starCatcherMeta, Component: StarCatcher },
  echo: { meta: echoLightsMeta, Component: EchoLights },
  memory: { meta: memoryMeta, Component: MemoryMatch },
  odd: { meta: oddOneOutMeta, Component: OddOneOut },
  count: { meta: quickCountMeta, Component: QuickCount },
  maze: { meta: mazeRunMeta, Component: MazeRun },
  slide: { meta: slidePuzzleMeta, Component: SlidePuzzle },
  three: { meta: threeInARowMeta, Component: ThreeInARow },
};

/** The Play tab, top to bottom: fast and loud first, thinking games next, calm puzzles last. */
export const SECTIONS: { title: TKey; games: GameId[] }[] = [
  { title: 'play.section.action', games: ['bubbles', 'moles', 'catch', 'echo'] },
  { title: 'play.section.brain', games: ['memory', 'odd', 'count', 'maze'] },
  { title: 'play.section.puzzles', games: ['slide', 'three'] },
];

export const isGameId = (id: string): id is GameId => id in GAMES;
