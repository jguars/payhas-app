import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Enter } from '@/components/motion/Enter';
import { TimesUp } from '@/features/library/TimesUp';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { useInsets } from '@/lib/useInsets';
import { spring, stagger } from '@/theme/motion';
import { alpha, color, font, Lane, lane as lanes, pageFill, radius, size, space, themedStyles } from '@/theme/tokens';

import { Confetti } from './Confetti';
import { Finish, GameBar, Readout } from './GameChrome';
import { CRITTERS, shuffle, useBest, useGameSession } from './shared';
import type { GameMeta, GameProps } from './types';

/**
 * Per-lane tuning.
 * - `up`: ms a pal stays up (before the ramp), `every`: ms between pop-ups.
 * - `ramp`: how much faster the end of the round is (0.4 → 40% shorter waits by the last second).
 * - `maxUp`: pals up at once (a decoy can be up on top of that).
 * Little: big burrows, no clock, no decoys — the round ends after `goal` happy taps.
 */
export const MOLES: Record<
  Lane,
  {
    cols: number;
    rows: number;
    up: number;
    every: number;
    round: number | null;
    goal: number | null;
    decoy: number;
    decoys: string[];
    penalty: number;
    ramp: number;
    maxUp: number;
    combo: boolean;
  }
> = {
  little: {
    cols: 2,
    rows: 3,
    up: 3000,
    every: 1300,
    round: null,
    goal: 12,
    decoy: 0,
    decoys: [],
    penalty: 0,
    ramp: 0,
    maxUp: 2,
    combo: false,
  },
  kids: {
    cols: 3,
    rows: 3,
    up: 1500,
    every: 950,
    round: 30,
    goal: null,
    decoy: 0.14,
    decoys: ['🌵'],
    penalty: 1,
    ramp: 0.35,
    maxUp: 2,
    combo: false,
  },
  teen: {
    cols: 3,
    rows: 3,
    up: 1050,
    every: 700,
    round: 30,
    goal: null,
    decoy: 0.26,
    decoys: ['🌵', '☁️'],
    penalty: 2,
    ramp: 0.45,
    maxUp: 3,
    combo: true,
  },
  adult: {
    cols: 3,
    rows: 3,
    up: 900,
    every: 600,
    round: 30,
    goal: null,
    decoy: 0.3,
    decoys: ['🌵', '☁️'],
    penalty: 3,
    ramp: 0.5,
    maxUp: 3,
    combo: true,
  },
};

const comboMult = (streak: number) => (streak >= 10 ? 3 : streak >= 5 ? 2 : 1);

type Pop = {
  id: number;
  slot: number;
  kind: 'pal' | 'decoy';
  symbol: string;
  up: number;
};
type HitResult = { label: string; good: boolean };

/** One round of Pop-up Pals. Remount (new key) to restart. */
export function PopUpPals({ lane, onAgain }: GameProps) {
  const cfg = MOLES[lane];
  const { lock } = useGameSession('moles');
  const best = useBest('moles', lane);
  const insets = useInsets();
  const { t } = useT();

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pops, setPops] = useState<Pop[]>([]);
  const [score, setScore] = useState(0);
  const [happy, setHappy] = useState(0);
  const [streak, setStreak] = useState(0);
  const [left, setLeft] = useState(cfg.round ?? 0);
  const [done, setDone] = useState<{ record: boolean; streak: number } | null>(null);
  const [pals] = useState(() => shuffle(CRITTERS));

  const popsRef = useRef<Pop[]>([]);
  const nextId = useRef(1);
  const lastSlot = useRef(-1);
  const elapsed = useRef(0);
  const streakRef = useRef(0);
  const bestStreak = useRef(0);
  const scoreRef = useRef(0);
  const happyRef = useRef(0);
  const quake = useSharedValue(0);

  // One-shot timers (end-of-round delays, label clean-up), all cleared on unmount.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  };
  useEffect(() => {
    const set = timers.current;
    return () => set.forEach(clearTimeout);
  }, []);

  const running = size.w > 0 && !done && !lock;
  const slots = cfg.cols * cfg.rows;

  const write = (next: Pop[]) => {
    popsRef.current = next;
    setPops(next);
  };

  // Pop-ups: a pal in a free burrow (never the same one twice in a row), sometimes a decoy.
  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setTimeout>;
    const speed = () => (cfg.round ? 1 - cfg.ramp * Math.min(1, elapsed.current / cfg.round) : 1);
    const tick = () => {
      const cur = popsRef.current;
      const used = new Set(cur.map((p) => p.slot));
      const free = Array.from({ length: slots }, (_, i) => i).filter((i) => !used.has(i) && i !== lastSlot.current);
      const palsUp = cur.filter((p) => p.kind === 'pal').length;
      const decoyUp = cur.some((p) => p.kind === 'decoy');
      if (free.length) {
        const slot = free[Math.floor(Math.random() * free.length)];
        const wantDecoy = cfg.decoy > 0 && !decoyUp && Math.random() < cfg.decoy;
        if (wantDecoy || palsUp < cfg.maxUp) {
          lastSlot.current = slot;
          const f = speed();
          write([
            ...cur,
            wantDecoy
              ? {
                  id: nextId.current++,
                  slot,
                  kind: 'decoy',
                  symbol: cfg.decoys[Math.floor(Math.random() * cfg.decoys.length)],
                  up: cfg.up * 1.3 * f,
                }
              : {
                  id: nextId.current++,
                  slot,
                  kind: 'pal',
                  symbol: pals[nextId.current % pals.length],
                  up: cfg.up * f * (0.85 + Math.random() * 0.3),
                },
          ]);
        }
      }
      timer = setTimeout(tick, cfg.every * speed() * (0.7 + Math.random() * 0.6));
    };
    timer = setTimeout(tick, 650); // let the garden land first
    return () => clearTimeout(timer);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  // Round clock (not for Little).
  useEffect(() => {
    if (!running || cfg.round == null) return;
    const id = setInterval(() => {
      elapsed.current += 1;
      setLeft((s) => s - 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running, cfg.round]);

  const ended = useRef(false);
  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    write([]);
    fx.win();
    setDone({
      record: cfg.goal == null ? best.submit(scoreRef.current) : false,
      streak: bestStreak.current,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cfg.round != null && left <= 0 && !done) finish();
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  /** A burrow's occupant has ducked back down (tapped or not). */
  const gone = useCallback(
    (id: number, tapped: boolean) => {
      const p = popsRef.current.find((x) => x.id === id);
      if (!p) return;
      if (!tapped && p.kind === 'pal' && cfg.combo) {
        streakRef.current = 0;
        setStreak(0);
      }
      write(popsRef.current.filter((x) => x.id !== id));
    },
    [cfg.combo],
  );

  const hit = (p: Pop): HitResult => {
    if (p.kind === 'decoy') {
      fx.wrong();
      streakRef.current = 0;
      setStreak(0);
      scoreRef.current = Math.max(0, scoreRef.current - cfg.penalty);
      setScore(scoreRef.current);
      quake.value = withSequence(
        withTiming(-6, { duration: 45 }),
        withTiming(6, { duration: 70 }),
        withTiming(-3, { duration: 55 }),
        withSpring(0, spring.snappy),
      );
      return { label: `−${cfg.penalty}`, good: false };
    }
    if (cfg.goal != null && happyRef.current >= cfg.goal) {
      fx.pop(); // the round is already won; extra taps still feel good
      return { label: '', good: true };
    }
    const s = streakRef.current + 1;
    streakRef.current = s;
    bestStreak.current = Math.max(bestStreak.current, s);
    const mult = cfg.combo ? comboMult(s) : 1;
    if (cfg.combo && (s === 5 || s === 10)) fx.combo();
    else fx.pop();
    setStreak(s);
    scoreRef.current += mult;
    setScore(scoreRef.current);
    if (cfg.goal != null) {
      happyRef.current += 1;
      setHappy(happyRef.current);
      if (happyRef.current === cfg.goal) later(finish, 450); // let the last pop play out
    }
    return { label: cfg.goal != null ? '' : `+${mult}`, good: true };
  };

  // Fit the garden under the top bar.
  const top = insets.top + 120;
  const bottom = insets.bottom + 40;
  const availW = size.w - space.lg * 2 - space.md * 2;
  const availH = size.h - top - bottom;
  const cell = Math.max(0, Math.min(availW / cfg.cols, availH / cfg.rows, 170));
  const gardenW = cell * cfg.cols;
  const gardenH = cell * cfg.rows;
  const mult = cfg.combo ? comboMult(streak) : 1;

  const gardenAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: quake.value }],
  }));
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Sky />

      {cell > 0 && (
        <Animated.View style={[styles.gardenWrap, { top: top + (availH - gardenH) / 2 - space.md }, gardenAnim]}>
          <View style={[styles.ledge, { width: gardenW + space.md * 2, height: gardenH + space.md * 2 }]} />
          <View style={[styles.garden, { width: gardenW + space.md * 2, height: gardenH + space.md * 2 }]}>
            {Array.from({ length: slots }, (_, i) => (
              <Burrow
                key={i}
                index={i}
                cell={cell}
                x={space.md + (i % cfg.cols) * cell}
                y={space.md + Math.floor(i / cfg.cols) * cell}
                pop={pops.find((p) => p.slot === i)}
                onHit={hit}
                onGone={gone}
              />
            ))}
          </View>
        </Animated.View>
      )}

      <GameBar>
        {cfg.round != null && <Readout label={t('play.readout.time')} value={`${Math.max(0, left)}`} />}
        {cfg.goal != null ? (
          <Readout label={t('moles.readout.pals')} value={`${happy}/${cfg.goal}`} />
        ) : (
          <Readout label={t('play.readout.score')} value={String(score)} />
        )}
      </GameBar>

      {!done && (
        <View pointerEvents="none" style={[styles.hintWrap, { top: insets.top + 64 }]}>
          {cfg.goal != null ? (
            <Progress n={happy} of={cfg.goal} />
          ) : (
            <View style={styles.hintRow}>
              {cfg.decoys.length > 0 && (
                <Enter style={styles.hint}>
                  <Text style={styles.hintText}>{t('moles.skip')}</Text>
                  <Text style={styles.hintEmoji}>{cfg.decoys.join(' ')}</Text>
                </Enter>
              )}
              {mult > 1 && (
                <Enter key={mult} rise={8} style={[styles.hint, styles.combo]}>
                  <Text style={styles.comboText}>×{mult}</Text>
                  <Text style={styles.hintText}>{streak}</Text>
                </Enter>
              )}
            </View>
          )}
        </View>
      )}

      {done && (
        <>
          <Confetti x={size.w / 2} y={size.h * 0.38} count={40} spread={1.2} />
          <Finish
            title={cfg.goal != null ? t('moles.hello') : score > 0 ? t('moles.quickPaws') : t('play.timeUp')}
            lines={
              cfg.goal != null
                ? [t('moles.happyTaps', { count: happy })]
                : [
                    t('play.points', { count: score }),
                    ...(cfg.combo && done.streak >= 3 ? [t('moles.bestStreak', { n: done.streak })] : []),
                    ...(best.read() != null && !done.record ? [t('play.best', { n: best.read() ?? 0 })] : []),
                  ]
            }
            record={done.record && score > 0}
            onAgain={onAgain}
          />
        </>
      )}
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

/**
 * One burrow: a soft mound with a hole; its occupant rises out of the hole
 * (clipped at the hole's middle so it reads as coming from inside), then ducks.
 */
function Burrow({
  index,
  cell,
  x,
  y,
  pop,
  onHit,
  onGone,
}: {
  index: number;
  cell: number;
  x: number;
  y: number;
  pop: Pop | undefined;
  onHit: (p: Pop) => HitResult;
  onGone: (id: number, tapped: boolean) => void;
}) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const enter = useSharedValue(reduce ? 1 : 0);
  const rise = useSharedValue(0);
  const squash = useSharedValue(0);
  const stretch = useSharedValue(0);
  const shake = useSharedValue(0);
  const dip = useSharedValue(0);
  const [shown, setShown] = useState<Pop | null>(null);
  const [result, setResult] = useState<(HitResult & { key: number }) | null>(null);
  const tapped = useRef<number | null>(null);

  const S = cell * 0.5; // critter size
  const holeCY = cell * 0.64;
  const travel = S + 6;
  const flip = index % 2 === 1; // mirror every other mound so the garden isn't stamped out

  useEffect(() => {
    if (!reduce) enter.value = withDelay(stagger(index), withSpring(1, spring.bouncy));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the last occupant on screen while it ducks away after the game has let go of it.
  if (pop && pop.id !== shown?.id) setShown(pop);

  // A new occupant: pop up with a little overshoot and stretch, wait, duck back down.
  useEffect(() => {
    if (!pop) return;
    const id = pop.id;
    stretch.value = reduce ? 0 : withSequence(withTiming(1, { duration: 0 }), withSpring(0, spring.bouncy));
    rise.value = withSequence(
      withTiming(1, {
        duration: reduce ? 120 : 230,
        easing: Easing.out(Easing.back(1.8)),
      }),
      withDelay(
        pop.up,
        withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) scheduleOnRN(onGone, id, false);
        }),
      ),
    );
  }, [pop?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = () => {
    if (!pop || tapped.current === pop.id) {
      // Empty burrow: a soft dip, no sound, no penalty.
      dip.value = withSequence(withTiming(1, { duration: 60 }), withSpring(0, spring.bouncy));
      return;
    }
    tapped.current = pop.id;
    const r = onHit(pop);
    setResult({ ...r, key: pop.id });
    const id = pop.id;
    cancelAnimation(rise);
    if (r.good) {
      // Squash, a star burst, and a quick happy duck.
      squash.value = withSequence(withTiming(1, { duration: 70 }), withSpring(0, spring.bouncy));
      rise.set(
        withDelay(
          170,
          withTiming(0, { duration: 190, easing: Easing.in(Easing.quad) }, (finished) => {
            if (finished) scheduleOnRN(onGone, id, true);
          }),
        ),
      );
    } else {
      // Decoy: a cross shake, then it sinks away grumpily.
      shake.value = withSequence(
        withTiming(-9, { duration: 45 }),
        withTiming(9, { duration: 70 }),
        withTiming(-6, { duration: 60 }),
        withTiming(4, { duration: 55 }),
        withSpring(0, spring.snappy),
      );
      rise.set(
        withDelay(
          320,
          withTiming(0, { duration: 220 }, (finished) => {
            if (finished) scheduleOnRN(onGone, id, true);
          }),
        ),
      );
    }
  };

  const cellAnim = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.4),
    transform: [{ translateY: (1 - enter.value) * 18 }, { scale: (0.7 + 0.3 * enter.value) * (1 - 0.05 * dip.value) }],
  }));
  const critter = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - rise.value) * travel },
      { translateX: shake.value },
      { scaleX: 1 + 0.28 * squash.value - 0.1 * stretch.value },
      { scaleY: 1 - 0.34 * squash.value + 0.16 * stretch.value },
    ],
  }));

  const occupant = shown;
  const isDecoy = occupant?.kind === 'decoy';
  const a11y = pop ? (pop.kind === 'pal' ? t('moles.pal', { symbol: pop.symbol }) : t('moles.decoy', { symbol: pop.symbol })) : t('moles.burrow');

  return (
    <Animated.View style={[styles.cell, { left: x, top: y, width: cell, height: cell }, cellAnim]}>
      <Pressable onPressIn={press} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={a11y}>
        {/* Back: the mound and the dark hole. */}
        <Svg pointerEvents="none" width={cell} height={cell} viewBox="0 0 100 100" style={[StyleSheet.absoluteFill, flip && { transform: [{ scaleX: -1 }] }]}>
          <Path
            d="M10 74 C 8 58, 22 49, 34 50 C 42 44, 60 44, 68 50 C 80 48, 93 57, 90 73 C 91 86, 76 92, 50 92 C 24 93, 9 87, 10 74 Z"
            fill={color.surface2}
            stroke={alpha(color.text, 0.1)}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Path d="M18 60 l -3 -8 M22 57 l 0 -9 M26 59 l 4 -8" stroke={alpha(color.success, 0.55)} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M76 56 l -2 -8 M81 58 l 3 -8" stroke={alpha(color.success, 0.45)} strokeWidth={2.6} strokeLinecap="round" />
          <Ellipse cx={50} cy={64} rx={33} ry={11.5} fill={color.ink} />
          <Ellipse cx={50} cy={61.5} rx={27} ry={7} fill={alpha(color.black, 0.5)} />
        </Svg>

        {/* The occupant, clipped at the hole's middle line. */}
        <View pointerEvents="none" style={[styles.clip, { height: holeCY }]}>
          {occupant && (
            <Animated.View style={[styles.critter, { width: S, height: S, left: (cell - S) / 2 }, critter]}>
              <Text style={{ fontSize: S * 0.86, lineHeight: S }}>{occupant.symbol}</Text>
              {isDecoy && occupant.symbol === '☁️' && <Text style={[styles.zzz, { fontSize: S * 0.3 }]}>💤</Text>}
            </Animated.View>
          )}
        </View>

        {/* Front lip of the hole, over the occupant. */}
        <Svg pointerEvents="none" width={cell} height={cell} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
          <Path d="M17 64 C 20 75, 80 75, 83 64" fill="none" stroke={color.line} strokeWidth={4.5} strokeLinecap="round" />
        </Svg>

        {result && result.key === occupant?.id && (
          <HitBurst key={result.key} good={result.good} label={result.label} x={cell / 2} y={holeCY - S * 0.55} reach={S * 0.95} />
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Stars flung out of a tapped pal (or a cross shake label for a decoy). Mounts once per hit. */
function HitBurst({ good, label, x, y, reach }: { good: boolean; label: string; x: number; y: number; reach: number }) {
  const reduce = useReducedMotion();
  const burst = useSharedValue(0);
  useEffect(() => {
    burst.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) });
  }, [burst]);
  const text = useAnimatedStyle(() => ({
    opacity: burst.value < 1 ? 1 - Math.max(0, burst.value - 0.55) / 0.45 : 0,
    transform: [{ translateY: -reach * 0.4 - 46 * burst.value }, { scale: 0.7 + 0.5 * Math.min(1, burst.value * 3) }],
  }));
  return (
    <View pointerEvents="none" style={[styles.burstAnchor, { left: x, top: y }]}>
      {good && !reduce && [0, 1, 2, 3, 4, 5].map((i) => <Spark key={i} i={i} burst={burst} reach={reach} />)}
      {label !== '' && <Animated.Text style={[styles.label, !good && { color: color.danger }, text]}>{label}</Animated.Text>}
    </View>
  );
}

/** One star of the hit burst, flung out on its own spoke. */
function Spark({ i, burst, reach }: { i: number; burst: SharedValue<number>; reach: number }) {
  const angle = -Math.PI / 2 + ((i - 2.5) / 6) * Math.PI * 1.6;
  const anim = useAnimatedStyle(() => {
    const b = burst.value;
    return {
      opacity: b > 0 && b < 1 ? 1 - b : 0,
      transform: [
        { translateX: Math.cos(angle) * reach * b },
        { translateY: Math.sin(angle) * reach * b + 18 * b * b },
        { rotate: `${b * 160}deg` },
        { scale: 1.2 - 0.6 * b },
      ],
    };
  });
  return <Animated.Text style={[styles.spark, i % 2 ? { color: color.text } : null, anim]}>★</Animated.Text>;
}

/** Little's progress: a row of dots that fill with sunshine, one per happy tap. */
function Progress({ n, of }: { n: number; of: number }) {
  return (
    <View style={styles.progress}>
      {Array.from({ length: of }, (_, i) => (
        <Dot key={i} on={i < n} />
      ))}
    </View>
  );
}

function Dot({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    s.value = reduce ? (on ? 1 : 0) : withSpring(on ? 1 : 0, spring.bouncy);
  }, [on, reduce, s]);
  const anim = useAnimatedStyle(() => ({
    opacity: s.value,
    transform: [{ scale: 0.4 + 0.6 * s.value }],
  }));
  return (
    <View style={styles.dot}>
      <Animated.View style={[styles.dotFill, anim]} />
    </View>
  );
}

/** Dusk over the garden: two slow soft glows, so the screen is never dead still. */
function Sky() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Glow tint={alpha(color.success, 0.08)} size={360} x={-120} y={420} dur={10000} />
      <Glow tint={alpha(color.reward, 0.07)} size={280} x={180} y={60} dur={12000} />
    </View>
  );
}

function Glow({ tint, size, x, y, dur }: { tint: string; size: number; x: number; y: number; dur: number }) {
  const reduce = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!reduce) v.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [dur, reduce, v]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: 30 * v.value }, { translateY: -24 * v.value }, { scale: 1 + 0.12 * v.value }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tint,
        },
        anim,
      ]}
    />
  );
}

// ── Play-tab card ─────────────────────────────────────────────────────────────

/** Three burrows on a lawn; pals take turns popping up, the middle one gets a star tap. */
function PalsScene({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const c = useSharedValue(0.4);
  useEffect(() => {
    if (reduce || !active) {
      cancelAnimation(c);
      if (reduce) c.value = 0.4;
      return;
    }
    c.value = 0;
    c.value = withRepeat(withTiming(1, { duration: 3600, easing: Easing.linear }), -1, false);
  }, [active, reduce, c]);
  // Burrow size from the stage: fits the 170 × 110 tile and the 360 × 170 hero.
  const u = Math.min(box.w / 3.5, box.h / 1.35, 92);
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) =>
        setBox({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
    >
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 340 170" preserveAspectRatio="xMidYMid slice">
        <Path d="M0 150 C 80 132, 160 160, 340 140 L 340 170 L 0 170 Z" fill={color.ink} opacity={0.12} />
        <Path d="M30 40 l 0 -10 M34 42 l 5 -9 M300 36 l -3 -10 M306 38 l 2 -10" stroke={color.ink} strokeOpacity={0.18} strokeWidth={3} strokeLinecap="round" />
      </Svg>
      {u > 0 && (
        <View style={[styles.sceneRow, { top: (box.h - u) / 2 + u * 0.08 }]}>
          {['🐰', '🐸', '🦊'].map((e, i) => (
            <MiniBurrow key={i} u={u} emoji={e} c={c} start={[0.04, 0.36, 0.66][i]} tapped={i === 1} />
          ))}
        </View>
      )}
    </View>
  );
}

function MiniBurrow({ u, emoji, c, start, tapped }: { u: number; emoji: string; c: SharedValue<number>; start: number; tapped: boolean }) {
  const len = 0.3;
  const holeY = u * 0.66;
  const S = u * 0.52;
  // Rise fast, hold, duck: a bump shaped from the shared loop clock.
  const body = useAnimatedStyle(() => {
    const t = (c.value - start) / len;
    let r = 0;
    if (t > 0 && t < 1) r = t < 0.2 ? 1 - Math.pow(1 - t / 0.2, 3) : t > 0.8 ? 1 - Math.pow((t - 0.8) / 0.2, 2) : 1;
    // The tapped one squashes at its middle.
    const hitT = tapped ? (t - 0.5) / 0.12 : -1;
    const sq = hitT > 0 && hitT < 1 ? Math.sin(hitT * Math.PI) : 0;
    return {
      transform: [{ translateY: (1 - r) * (S + 4) }, { scaleX: 1 + 0.25 * sq }, { scaleY: 1 - 0.3 * sq }],
    };
  });
  const star = useAnimatedStyle(() => {
    const t = tapped ? ((c.value - start) / len - 0.5) / 0.35 : -1;
    const v = t > 0 && t < 1 ? t : 0;
    return {
      opacity: v > 0 ? 1 - v : 0,
      transform: [{ translateY: -S * 0.6 - 26 * v }, { scale: 0.6 + v }, { rotate: `${v * 90}deg` }],
    };
  });
  return (
    <View style={{ width: u, height: u }}>
      <Svg width={u} height={u} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Path
          d="M10 74 C 8 58, 22 49, 34 50 C 42 44, 60 44, 68 50 C 80 48, 93 57, 90 73 C 91 86, 76 92, 50 92 C 24 93, 9 87, 10 74 Z"
          fill={color.ink}
          opacity={0.18}
        />
        <Ellipse cx={50} cy={66} rx={32} ry={11} fill={color.ink} />
      </Svg>
      <View style={[styles.clip, { height: holeY }]}>
        <Animated.View style={[styles.critter, { width: S, height: S, left: (u - S) / 2 }, body]}>
          <Text style={{ fontSize: S * 0.84, lineHeight: S }}>{emoji}</Text>
        </Animated.View>
      </View>
      <Svg width={u} height={u} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Path d="M18 66 C 21 77, 79 77, 82 66" fill="none" stroke={color.ink} strokeOpacity={0.55} strokeWidth={4} strokeLinecap="round" />
      </Svg>
      {tapped && <Animated.Text style={[styles.sceneStar, { left: u / 2 - 12, top: holeY - S * 0.5 }, star]}>★</Animated.Text>}
    </View>
  );
}

export const popUpPalsMeta: GameMeta = {
  id: 'moles',
  name: 'moles.name',
  sub: (lane, t) => {
    const cfg = MOLES[lane];
    if (cfg.round == null) return t('moles.subLittle');
    return cfg.decoys.length ? t('moles.subDecoy', { s: cfg.round }) : t('moles.sub', { s: cfg.round });
  },
  tint: lanes.kids.color,
  Scene: PalsScene,
  best: {
    format: (n, _lane, t) => t('play.ptsShort', { count: n }),
    // 30 s rounds; combo lanes can score far higher.
    stars: (n, lane) => {
      const [three, two] = lane === 'kids' ? [28, 14] : [60, 30];
      return n >= three ? 3 : n >= two ? 2 : 1;
    },
    hiddenFor: ['little'],
  },
};

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill(), overflow: 'hidden' },
  gardenWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  ledge: {
    position: 'absolute',
    top: 6,
    borderRadius: radius.video,
    backgroundColor: alpha(color.success, 0.1),
  },
  garden: {
    borderRadius: radius.video,
    backgroundColor: alpha(color.success, 0.06),
    borderWidth: 2,
    borderColor: alpha(color.success, 0.14),
  },
  cell: { position: 'absolute' },
  clip: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
  critter: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  zzz: { position: 'absolute', right: -4, top: -2 },
  burstAnchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  spark: {
    position: 'absolute',
    width: 30,
    left: -15,
    top: -14,
    textAlign: 'center',
    color: color.reward,
    fontSize: size.title,
  },
  label: {
    position: 'absolute',
    width: 80,
    left: -40,
    top: -16,
    textAlign: 'center',
    color: color.text,
    fontFamily: font.display,
    fontSize: size.heading,
    letterSpacing: -0.5,
  },
  hintWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hintRow: { flexDirection: 'row', gap: space.sm },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: alpha(color.surface1, 0.85),
    borderWidth: 1,
    borderColor: color.line,
  },
  hintText: { color: color.text2, fontFamily: font.semibold, fontSize: size.small },
  hintEmoji: { fontSize: 20 },
  combo: { borderColor: alpha(color.reward, 0.5) },
  comboText: {
    color: color.reward,
    fontFamily: font.display,
    fontSize: size.lead,
    letterSpacing: -0.4,
  },
  progress: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: space.xl,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFill: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: color.reward,
  },
  sceneRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  sceneStar: {
    position: 'absolute',
    width: 24,
    textAlign: 'center',
    color: color.white,
    fontSize: size.title,
  },
}));
