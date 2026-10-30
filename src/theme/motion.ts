import type { WithSpringConfig } from 'react-native-reanimated';

/** Spring presets — use these instead of inventing damping numbers per element. */
export const spring = {
  /** Press feedback, toggles. Settles fast, no wobble. */
  snappy: { damping: 22, stiffness: 380, mass: 0.6 },
  /** Entrances and layout moves. */
  smooth: { damping: 26, stiffness: 170, mass: 1 },
  /** Small celebratory pops (a selected swatch, a badge). */
  bouncy: { damping: 11, stiffness: 220, mass: 0.7 },
} satisfies Record<string, WithSpringConfig>;

/** Delay between siblings entering. ~2–3 frames at 60fps reads as a cascade, not a wait. */
export const STAGGER_MS = 45;

export const stagger = (i: number, step = STAGGER_MS) => i * step;

/** Durations for timed (non-spring) changes: fades, colour changes, progress. */
export const duration = { fast: 150, base: 250, slow: 400 } as const;
