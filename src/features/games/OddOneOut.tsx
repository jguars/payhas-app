import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Pop } from '@/components/motion/Pop';
import { TimesUp } from '@/features/library/TimesUp';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { useInsets } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { alpha, color, font, Lane, lane as lanes, radius, space } from '@/theme/tokens';

import { Confetti } from './Confetti';
import { Finish, GameBar, Readout } from './GameChrome';
import { CRITTERS, useBest, useGameSession } from './shared';
import type { GameMeta, GameProps } from './types';

/**
 * Per-lane tuning. `grid(finds)` gives the board size as the round goes on;
 * `goal` ends Little's round happily; `penalty` is seconds off the clock for a
 * wrong tap (Little and Kids never lose anything).
 */
const ODD: Record<Lane, { grid: (finds: number) => number; round: number | null; goal: number | null; penalty: number }> = {
  little: { grid: () => 2, round: null, goal: 8, penalty: 0 },
  kids: { grid: (f) => (f < 5 ? 3 : 4), round: 45, goal: null, penalty: 0 },
  teen: { grid: (f) => (f < 4 ? 4 : f < 10 ? 5 : 6), round: 45, goal: null, penalty: 2 },
  adult: { grid: (f) => (f < 3 ? 4 : f < 7 ? 5 : 6), round: 45, goal: null, penalty: 2 },
};

/** Kids: look-alikes you can tell apart with a careful look. */
const KIDS_PAIRS: [string, string][] = [
  ['🐶', '🐺'],
  ['🍎', '🍅'],
  ['🐱', '🐯'],
  ['🐭', '🐹'],
  ['🐻', '🐼'],
  ['🐸', '🐢'],
  ['🍊', '🍑'],
  ['🍋', '🍌'],
  ['🐝', '🐞'],
  ['🐧', '🐦'],
  ['🌻', '🌼'],
  ['🚗', '🚕'],
  ['🐟', '🐠'],
  ['🐥', '🐤'],
  ['🍪', '🍩'],
  ['⚽', '🏀'],
  ['🍓', '🍒'],
  ['🐷', '🐽'],
  ['🍦', '🍧'],
  ['🐳', '🐋'],
  ['🦁', '🐯'],
  ['🐮', '🐷'],
  ['🌙', '⭐'],
  ['🍐', '🍏'],
  ['🚌', '🚎'],
  ['🎈', '🎀'],
];

/**
 * Teen and Adult: near-twins. Tier 1 is "look twice", tier 2 is "look three
 * times". All are Unicode ≤ 12 so they render on older phones too.
 */
const TWINS: { a: string; b: string; tier: 1 | 2 }[] = [
  { a: '🐪', b: '🐫', tier: 1 },
  { a: '🍀', b: '☘️', tier: 1 },
  { a: '🔒', b: '🔓', tier: 1 },
  { a: '🐁', b: '🐀', tier: 1 },
  { a: '🐆', b: '🐅', tier: 1 },
  { a: '🐊', b: '🦎', tier: 1 },
  { a: '🌲', b: '🌳', tier: 1 },
  { a: '⌛', b: '⏳', tier: 1 },
  { a: '📕', b: '📙', tier: 1 },
  { a: '📗', b: '📘', tier: 1 },
  { a: '🌑', b: '🌚', tier: 1 },
  { a: '🌕', b: '🌝', tier: 1 },
  { a: '🎵', b: '🎶', tier: 1 },
  { a: '😠', b: '😡', tier: 1 },
  { a: '😐', b: '😑', tier: 1 },
  { a: '🐂', b: '🐃', tier: 1 },
  { a: '🌧️', b: '🌦️', tier: 1 },
  { a: '🌸', b: '💮', tier: 1 },
  { a: '😀', b: '😃', tier: 2 },
  { a: '😃', b: '😄', tier: 2 },
  { a: '😁', b: '😆', tier: 2 },
  { a: '😗', b: '😙', tier: 2 },
  { a: '😙', b: '😚', tier: 2 },
  { a: '😟', b: '🙁', tier: 2 },
  { a: '😮', b: '😯', tier: 2 },
  { a: '😥', b: '😓', tier: 2 },
  { a: '😰', b: '😨', tier: 2 },
  { a: '😣', b: '😖', tier: 2 },
  { a: '🔍', b: '🔎', tier: 2 },
  { a: '🔉', b: '🔊', tier: 2 },
  { a: '🔅', b: '🔆', tier: 2 },
  { a: '🕑', b: '🕒', tier: 2 },
  { a: '🕐', b: '🕜', tier: 2 },
  { a: '🌖', b: '🌗', tier: 2 },
  { a: '⛅', b: '🌥️', tier: 2 },
  { a: '💗', b: '💖', tier: 2 },
  { a: '💓', b: '💞', tier: 2 },
];

/** Things with a clear "this way up" and a facing direction, for turned and mirrored boards. */
const DIRECTIONAL = ['🐌', '🦒', '🐘', '🚗', '🐟', '🦕', '🐿️', '🦜', '🐓', '🚲', '🛴', '🐎', '🦖', '🚀', '🎸', '🔑', '✏️', '🍌', '🐢', '🦆', '🐇', '🦩', '⛵', '🐋'];

type Kind = 'animal' | 'pair' | 'twin' | 'turn' | 'mirror' | 'size';
type Board = { id: number; n: number; common: string; odd: string; at: number; kind: Kind; turn: number; flip: boolean; scale: number };

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const coin = () => Math.random() < 0.5;

let boardId = 1;

function makeBoard(lane: Lane, finds: number, prev: Board | null): Board {
  const n = ODD[lane].grid(finds);
  let at = Math.floor(Math.random() * n * n);
  if (prev && prev.n === n && at === prev.at) at = (at + 1 + Math.floor(Math.random() * (n * n - 1))) % (n * n);
  const base = { id: boardId++, n, at, turn: 0, flip: false, scale: 1 };

  if (lane === 'little') {
    const common = pick(CRITTERS.filter((c) => c !== prev?.common));
    return { ...base, kind: 'animal', common, odd: pick(CRITTERS.filter((c) => c !== common)) };
  }
  if (lane === 'kids') {
    const [a, b] = pick(KIDS_PAIRS.filter(([x, y]) => x !== prev?.common && y !== prev?.common));
    return { ...base, kind: 'pair', ...(coin() ? { common: a, odd: b } : { common: b, odd: a }) };
  }

  // Teen / Adult: the difference gets subtler as the round goes on.
  const adult = lane === 'adult';
  const kind: Kind = pick(['twin', 'twin', 'turn', 'mirror', 'size'] as Kind[]);
  if (kind === 'twin') {
    const hard = adult ? finds >= 4 : finds >= 8;
    const pool = TWINS.filter((p) => (hard ? true : p.tier === 1) && p.a !== prev?.common && p.b !== prev?.common);
    const { a, b } = pick(pool);
    return { ...base, kind, ...(coin() ? { common: a, odd: b } : { common: b, odd: a }) };
  }
  const symbol = pick(DIRECTIONAL.filter((s) => s !== prev?.common));
  if (kind === 'turn') {
    const deg = Math.max(adult ? 14 : 22, (adult ? 70 : 90) - finds * (adult ? 5 : 5));
    return { ...base, kind, common: symbol, odd: symbol, turn: coin() ? deg : -deg };
  }
  if (kind === 'mirror') return { ...base, kind, common: symbol, odd: symbol, flip: true };
  // size: smaller or bigger, closer to 1 as finds climb
  const d = Math.max(adult ? 0.1 : 0.13, (adult ? 0.24 : 0.3) - finds * 0.012);
  return { ...base, kind, common: symbol, odd: symbol, scale: coin() ? 1 - d : 1 + d * 0.8 };
}

/** One round of Odd One Out. Remount (new key) to restart. */
export function OddOneOut({ lane, onAgain }: GameProps) {
  const cfg = ODD[lane];
  const { lock } = useGameSession('odd');
  const best = useBest('odd', lane);
  const { t } = useT();
  const insets = useInsets();

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [board, setBoard] = useState<Board>(() => makeBoard(lane, 0, null));
  const [finds, setFinds] = useState(0);
  const [found, setFound] = useState(false);
  const [left, setLeft] = useState(cfg.round ?? 0);
  const [penalties, setPenalties] = useState(0);
  const [misses, setMisses] = useState(0); // Little: a slip makes the odd one wiggle as a hint
  const [done, setDone] = useState<{ record: boolean } | null>(null);
  const [prevBest] = useState(() => best.read());
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const running = size.w > 0 && !done && !lock;

  const leftRef = useRef(cfg.round ?? 0);
  const findsRef = useRef(0);
  const ended = useRef(false);

  /** Clock ran out: score the round. */
  const timeUp = () => {
    if (ended.current) return;
    ended.current = true;
    busy.current = true;
    fx.timesUp();
    const record = findsRef.current > 0 && best.submit(findsRef.current);
    if (record) timers.current.push(setTimeout(fx.win, 400));
    setDone({ record });
  };
  const spend = (s: number) => {
    if (ended.current) return;
    leftRef.current = Math.max(0, leftRef.current - s);
    setLeft(leftRef.current);
    if (leftRef.current === 0) timeUp();
  };

  // Round clock (not for Little).
  useEffect(() => {
    if (!running || cfg.round == null) return;
    const id = setInterval(() => spend(1), 1000);
    return () => clearInterval(id);
  }, [running, cfg.round]); // eslint-disable-line react-hooks/exhaustive-deps

  const tapRight = () => {
    busy.current = true;
    const next = finds + 1;
    findsRef.current = next;
    setFinds(next);
    setFound(true);
    if (next % 5 === 0) fx.combo();
    else fx.pop();
    if (cfg.goal != null && next >= cfg.goal) {
      timers.current.push(
        setTimeout(() => {
          fx.win();
          setDone({ record: false });
        }, 520),
      );
      return;
    }
    timers.current.push(
      setTimeout(() => {
        setBoard((b) => makeBoard(lane, next, b));
        setFound(false);
        setMisses(0);
        busy.current = false;
      }, 520),
    );
  };

  const tapWrong = () => {
    if (lane === 'little') {
      fx.flip();
      setMisses((m) => m + 1);
      return;
    }
    fx.wrong();
    if (cfg.penalty > 0) {
      setPenalties((p) => p + 1);
      spend(cfg.penalty);
    }
  };

  const tap = (i: number) => {
    if (busy.current || done || lock) return false;
    if (i === board.at) {
      tapRight();
      return true;
    }
    tapWrong();
    return false;
  };

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const n = board.n;
  const gap = n >= 5 ? 8 : n === 2 ? 16 : 10;
  const availW = size.w - space.lg * 2;
  const availH = size.h - insets.top - 190;
  const cell = Math.max(0, Math.min((availW - gap * (n - 1)) / n, (availH - gap * (n - 1)) / n, n === 2 ? 160 : 112));
  const gridW = cell * n + gap * (n - 1);

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GameBar>
        {cfg.round != null && <Readout label={t('play.readout.time')} value={String(Math.max(0, left))} />}
        <Readout label={t('odd.readout.found')} value={cfg.goal != null ? `${finds}/${cfg.goal}` : String(finds)} />
      </GameBar>

      {penalties > 0 && cfg.round != null && <Penalty key={penalties} top={insets.top + 64} amount={cfg.penalty} />}

      {cell > 0 && (
        <View style={{ marginTop: insets.top + 40, alignItems: 'center', gap: space.xl }}>
          <View key={board.id} style={{ width: gridW, height: gridW + LEDGE, flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {Array.from({ length: n * n }, (_, i) => (
              <Cell key={i} index={i} n={n} board={board} size={cell} found={found} hint={lane === 'little' && misses > 0 && i === board.at} soft={lane === 'little'} onTap={tap} />
            ))}
          </View>
          {cfg.goal != null && <Stars count={cfg.goal} filled={finds} />}
        </View>
      )}

      {done && (
        <>
          {(cfg.goal != null || done.record) && <Confetti x={size.w / 2} y={size.h * 0.4} count={44} spread={1.3} />}
          <Finish
            title={cfg.goal != null ? t('play.foundAll') : finds > 0 ? t('odd.sharpEyes') : t('play.timeUp')}
            lines={[
              t('odd.finds', { count: finds }),
              ...(cfg.goal == null && prevBest != null && !done.record ? [t('play.best', { n: Math.max(prevBest, finds) })] : []),
            ]}
            record={done.record}
            onAgain={onAgain}
          />
        </>
      )}
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

const LEDGE = 4;

type CellProps = { index: number; n: number; board: Board; size: number; found: boolean; hint: boolean; soft: boolean; onTap: (i: number) => boolean };

function Cell({ index, n, board, size, found, hint, soft, onTap }: CellProps) {
  const reduce = useReducedMotion();
  const isOdd = index === board.at;
  const deal = useSharedValue(reduce ? 1 : 0);
  const press = useSharedValue(0);
  const shake = useSharedValue(0);
  const pop = useSharedValue(1);
  const ring = useSharedValue(0);
  const fade = useSharedValue(1);
  const wiggle = useSharedValue(0);
  const [wrong, setWrong] = useState(false);

  // Dealt in as a diagonal wave from the top-left.
  useEffect(() => {
    if (reduce) return;
    const row = Math.floor(index / n);
    const col = index % n;
    deal.value = withDelay((row + col) * 28, withSpring(1, spring.bouncy));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!found) return;
    if (isOdd) {
      ring.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.quad) });
      if (!reduce) pop.value = withSequence(withTiming(1.28, { duration: 110 }), withSpring(1.08, spring.bouncy));
    } else {
      fade.value = withTiming(0.25, { duration: 220 });
    }
  }, [found]); // eslint-disable-line react-hooks/exhaustive-deps

  // Little's hint: the different one does a happy wiggle until it's found.
  useEffect(() => {
    if (!hint || reduce) return;
    wiggle.value = withRepeat(withSequence(withTiming(1, { duration: 140 }), withTiming(-1, { duration: 180 }), withTiming(0, { duration: 140 }), withDelay(500, withTiming(0, { duration: 0 }))), -1, false);
    return () => {
      wiggle.value = withTiming(0, { duration: 120 });
    };
  }, [hint, reduce, wiggle]);

  const press_ = () => {
    const right = onTap(index);
    if (right || found) return;
    if (reduce) return;
    setWrong(true);
    const k = soft ? 0.6 : 1;
    shake.value = withSequence(withTiming(-6 * k, { duration: 45 }), withTiming(6 * k, { duration: 65 }), withTiming(-3 * k, { duration: 55 }), withSpring(0, spring.snappy));
  };

  useEffect(() => {
    if (!wrong) return;
    const id = setTimeout(() => setWrong(false), 380);
    return () => clearTimeout(id);
  }, [wrong]);

  const shell = useAnimatedStyle(() => ({
    opacity: Math.min(1, deal.value * 1.4) * fade.value,
    transform: [{ translateX: shake.value }, { scale: (0.4 + 0.6 * deal.value) * pop.value * (0.92 + 0.08 * fade.value) }, { rotate: `${wiggle.value * 10}deg` }],
  }));
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * LEDGE }] }));
  const burst = useAnimatedStyle(() => ({ opacity: ring.value > 0 ? 1 - ring.value : 0, transform: [{ scale: 1 + 0.7 * ring.value }] }));

  const symbol = isOdd ? board.odd : board.common;
  const glyph = isOdd ? { transform: [{ rotate: `${board.turn}deg` }, { scaleX: board.flip ? -1 : 1 }, { scale: board.scale }] } : null;
  const r = Math.min(radius.card, size * 0.26);
  const tileTint = found && isOdd ? alpha(color.success, 0.22) : color.surface1;
  const edge = found && isOdd ? color.success : wrong ? (soft ? color.text3 : color.danger) : color.line;

  return (
    <Animated.View style={[{ width: size, height: size + LEDGE }, shell]}>
      <View style={[styles.cellLedge, { width: size, height: size, borderRadius: r, backgroundColor: edge }]} />
      <Pressable
        onPressIn={() => {
          press.value = withSpring(1, spring.snappy);
          press_();
        }}
        onPressOut={() => (press.value = withSpring(0, spring.bouncy))}
        accessibilityRole="button"
        accessibilityLabel={symbol}
        style={{ width: size, height: size }}
      >
        <Animated.View style={[styles.cell, { width: size, height: size, borderRadius: r, backgroundColor: tileTint, borderColor: edge }, face]}>
          <Text style={[{ fontSize: size * 0.56 }, glyph]}>{symbol}</Text>
        </Animated.View>
      </Pressable>
      <Animated.View pointerEvents="none" style={[styles.burst, { width: size, height: size, borderRadius: r }, burst]} />
    </Animated.View>
  );
}

/** Little's progress, as a row of stars that fill in. */
function Stars({ count, filled }: { count: number; filled: number }) {
  return (
    <View style={styles.stars}>
      {Array.from({ length: count }, (_, i) => (
        <Pop key={i} on={i < filled} peak={1.6}>
          <Text style={[styles.star, i >= filled && styles.starOff]}>⭐</Text>
        </Pop>
      ))}
    </View>
  );
}

/** "−2" drifting up under the clock when a wrong tap costs time. */
function Penalty({ top, amount }: { top: number; amount: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
  }, [v]);
  const anim = useAnimatedStyle(() => ({ opacity: 1 - v.value, transform: [{ translateY: -20 * v.value }, { scale: 1 + 0.2 * (1 - v.value) }] }));
  return (
    <Animated.Text pointerEvents="none" style={[styles.penalty, { top }, anim]}>
      −{amount}
    </Animated.Text>
  );
}

// ── Play-tab card ────────────────────────────────────────────────────────────

const SCENE_SETS: [string, string][] = [
  ['🐶', '🐺'],
  ['🍎', '🍅'],
  ['🐱', '🐯'],
  ['🐻', '🐼'],
];

/** A 3×3 of look-alikes; every couple of seconds a new board deals in and the odd one gets "found". */
function OddScene({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (reduce || !active) return;
    const id = setInterval(() => setRound((r) => r + 1), 2600);
    return () => clearInterval(id);
  }, [active, reduce]);
  const [a, b] = SCENE_SETS[round % SCENE_SETS.length];
  const at = [4, 2, 6, 7][round % 4];
  return (
    <View key={round} style={styles.miniGrid}>
      {Array.from({ length: 9 }, (_, i) => (
        <MiniCell key={i} index={i} symbol={i === at ? b : a} odd={i === at} animate={!reduce && active} />
      ))}
    </View>
  );
}

function MiniCell({ index, symbol, odd, animate }: { index: number; symbol: string; odd: boolean; animate: boolean }) {
  const deal = useSharedValue(animate ? 0 : 1);
  const pop = useSharedValue(1);
  const ring = useSharedValue(0);
  useEffect(() => {
    if (!animate) return;
    deal.value = withDelay((Math.floor(index / 3) + (index % 3)) * 50, withSpring(1, spring.bouncy));
    if (odd) {
      pop.value = withDelay(1300, withSequence(withTiming(1.3, { duration: 120 }), withSpring(1.08, spring.bouncy)));
      ring.value = withDelay(1300, withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cellAnim = useAnimatedStyle(() => ({ opacity: Math.min(1, deal.value * 1.4), transform: [{ scale: (0.4 + 0.6 * deal.value) * pop.value }] }));
  const burst = useAnimatedStyle(() => ({ opacity: ring.value > 0 ? 1 - ring.value : 0, transform: [{ scale: 1 + 0.8 * ring.value }] }));
  return (
    <Animated.View style={[styles.miniCell, cellAnim]}>
      <Text style={styles.miniEmoji}>{symbol}</Text>
      <Animated.View style={[styles.miniBurst, burst]} />
    </Animated.View>
  );
}

const ODD_STARS: Record<Lane, [number, number]> = {
  little: [5, 8],
  kids: [14, 20],
  teen: [16, 22],
  adult: [16, 22],
};

export const oddOneOutMeta: GameMeta = {
  id: 'odd',
  name: 'odd.name',
  sub: (lane, t) =>
    lane === 'little' ? t('odd.sub.little') : lane === 'kids' ? t('odd.sub.kids', { s: ODD.kids.round ?? 0 }) : t('odd.sub.hard', { s: ODD[lane].round ?? 0 }),
  tint: lanes.kids.color,
  Scene: OddScene,
  best: {
    format: (n, _lane, t) => t('odd.finds', { count: n }),
    stars: (n, lane) => {
      const [two, three] = ODD_STARS[lane];
      return n >= three ? 3 : n >= two ? 2 : 1;
    },
    hiddenFor: ['little'],
  },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink, alignItems: 'center', overflow: 'hidden' },
  cellLedge: { position: 'absolute', left: 0, top: LEDGE },
  cell: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  burst: { position: 'absolute', left: 0, top: 0, borderWidth: 3, borderColor: color.success },
  stars: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 26 },
  starOff: { opacity: 0.22 },
  penalty: { position: 'absolute', right: space.xl + 8, color: color.ember, fontFamily: font.display, fontSize: 24, letterSpacing: -0.5, zIndex: 20 },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 3 * 28 + 2 * 5, gap: 5 },
  miniCell: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: color.ink, backgroundColor: color.text, alignItems: 'center', justifyContent: 'center' },
  miniEmoji: { fontSize: 16 },
  miniBurst: { position: 'absolute', left: -2, top: -2, width: 28, height: 28, borderRadius: 8, borderWidth: 3, borderColor: color.ink },
});
