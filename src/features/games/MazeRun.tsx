import { useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, PanResponder, PanResponderGestureState, Pressable, StyleSheet, Text, View } from 'react-native';
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
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { TimesUp } from '@/features/library/TimesUp';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { useInsets } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { alpha, color, Lane, lane as lanes, radius, space } from '@/theme/tokens';

import { Confetti } from './Confetti';
import { Finish, GameBar, Readout } from './GameChrome';
import { CRITTERS, shuffle, useBest, useGameSession } from './shared';
import type { GameMeta, GameProps } from './types';

/**
 * Per-lane tuning. Little gets a tiny maze with glowing breadcrumbs home and
 * keeps no score; Kids time quietly; Teen and Adult race a visible clock, and
 * Adult can grab stars that knock seconds off.
 */
export const MAZE: Record<Lane, { n: number; hint: boolean; clock: boolean; scored: boolean; stars: number }> = {
  little: { n: 4, hint: true, clock: false, scored: false, stars: 0 },
  kids: { n: 7, hint: false, clock: false, scored: true, stars: 0 },
  teen: { n: 10, hint: false, clock: true, scored: true, stars: 0 },
  adult: { n: 13, hint: false, clock: true, scored: true, stars: 3 },
};

const STAR_BONUS = 3; // seconds off per star
const PAD_BTN = 64;
const LEDGE = 5;
const HOME = '🏡';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ── the maze ─────────────────────────────────────────────────────────────────

type Dir = 'up' | 'down' | 'left' | 'right';
/** Open-passage bits per cell. */
const BIT: Record<Dir, number> = { up: 1, right: 2, down: 4, left: 8 };
const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const DX: Record<Dir, number> = { up: 0, down: 0, left: -1, right: 1 };
const DY: Record<Dir, number> = { up: -1, down: 1, left: 0, right: 0 };
const DIRS: Dir[] = ['up', 'right', 'down', 'left'];

/** A perfect maze (exactly one route between any two cells) by recursive backtracking. */
function generate(n: number): number[] {
  const cells = new Array<number>(n * n).fill(0);
  const seen = new Array<boolean>(n * n).fill(false);
  const stack = [0];
  seen[0] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const x = cur % n;
    const y = Math.floor(cur / n);
    const open = DIRS.filter((d) => {
      const nx = x + DX[d];
      const ny = y + DY[d];
      return nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[ny * n + nx];
    });
    if (!open.length) {
      stack.pop();
      continue;
    }
    const d = open[Math.floor(Math.random() * open.length)];
    const next = (y + DY[d]) * n + x + DX[d];
    cells[cur] |= BIT[d];
    cells[next] |= BIT[OPP[d]];
    seen[next] = true;
    stack.push(next);
  }
  return cells;
}

/** Shortest route from `from` to `to` (cells after `from`, ending at `to`). */
function route(cells: number[], n: number, from: number, to: number): number[] {
  const prev = new Array<number>(n * n).fill(-1);
  prev[from] = from;
  const queue = [from];
  while (queue.length) {
    const c = queue.shift()!;
    if (c === to) break;
    for (const d of DIRS) {
      if (!(cells[c] & BIT[d])) continue;
      const nx = c + DX[d] + DY[d] * n;
      if (prev[nx] === -1) {
        prev[nx] = c;
        queue.push(nx);
      }
    }
  }
  const out: number[] = [];
  for (let c = to; c !== from && c !== -1; c = prev[c]) out.unshift(c);
  return out;
}

/** Every wall as one path: top and left borders, then each cell's closed east and south sides. */
function wallPath(cells: number[], n: number, s: number) {
  let d = `M0 0H${n * s}M0 0V${n * s}`;
  for (let i = 0; i < cells.length; i++) {
    const x = (i % n) * s;
    const y = Math.floor(i / n) * s;
    if (!(cells[i] & BIT.right)) d += `M${x + s} ${y}V${y + s}`;
    if (!(cells[i] & BIT.down)) d += `M${x} ${y + s}H${x + s}`;
  }
  return d;
}

// ── the game ─────────────────────────────────────────────────────────────────

/** One round of Maze Run. Remount (new key) for a fresh maze. */
export function MazeRun({ lane, onAgain }: GameProps) {
  const cfg = MAZE[lane];
  const n = cfg.n;
  const goal = n * n - 1;
  const { lock } = useGameSession('maze');
  const best = useBest('maze', lane);
  const { t } = useT();
  const insets = useInsets();
  const reduce = useReducedMotion();
  const tint = lanes[lane].color;

  const [cells] = useState(() => generate(n));
  const [critter] = useState(() => shuffle(CRITTERS)[0]);
  const [stars] = useState(() => shuffle(Array.from({ length: n * n }, (_, i) => i).filter((i) => i % n > 1 || Math.floor(i / n) > 1)).filter((i) => i !== goal).slice(0, cfg.stars));
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState(0);
  const [trail, setTrail] = useState<number[]>([0]);
  const [got, setGot] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState<{ record: boolean; time: number; score: number } | null>(null);
  const posRef = useRef(0);
  const started = useRef<number | null>(null);
  const gotRef = useRef<number[]>([]);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Board: as big as fits between the bar and the arrow pad.
  const padH = PAD_BTN * 2 + space.sm + LEDGE * 2;
  const top = insets.top + 64;
  const availH = size.h - top - padH - insets.bottom - space.xl * 3;
  const board = Math.max(0, Math.floor(Math.min(size.w - space.lg * 2, availH, 560)));
  const cell = board / n;
  const wall = Math.max(4, Math.min(12, cell * (n <= 4 ? 0.12 : 0.2)));

  // Critter position in px (springs), plus a nudge for bumping into walls and a squash on landing.
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const nudgeX = useSharedValue(0);
  const nudgeY = useSharedValue(0);
  const squash = useSharedValue(0);
  const face = useSharedValue(1);
  const cheer = useSharedValue(0);

  useEffect(() => {
    // Snap into place when the board is first measured or resized.
    x.value = (posRef.current % n) * cell;
    y.value = Math.floor(posRef.current / n) * cell;
  }, [cell]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (done || lock) return;
    const id = setInterval(() => {
      if (started.current != null) setSeconds(Math.floor((Date.now() - started.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [done, lock]);

  useEffect(
    () => () => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
    },
    [],
  );

  const canGo = (c: number, d: Dir) => (cells[c] & BIT[d]) !== 0;
  /** A cell with a side opening (anything but straight on or straight back) is a junction: stop there. */
  const junction = (c: number, d: Dir) => DIRS.some((o) => o !== d && o !== OPP[d] && canGo(c, o));

  const move = (d: Dir, slide: boolean) => {
    if (done || lock || cell <= 0 || finishTimer.current) return;
    let c = posRef.current;
    const path: number[] = [];
    while (canGo(c, d)) {
      c += DX[d] + DY[d] * n;
      path.push(c);
      if (!slide || c === goal || junction(c, d)) break;
    }
    if (d === 'left' || d === 'right') face.value = withSpring(d === 'left' ? -1 : 1, spring.snappy);

    if (!path.length) {
      // Bonk: a little nudge into the wall, no penalty.
      fx.tap();
      if (!reduce) {
        const push = cell * 0.14;
        nudgeX.value = withSequence(withTiming(DX[d] * push, { duration: 60 }), withSpring(0, spring.bouncy));
        nudgeY.value = withSequence(withTiming(DY[d] * push, { duration: 60 }), withSpring(0, spring.bouncy));
      }
      return;
    }

    if (started.current == null) started.current = Date.now();
    posRef.current = c;
    setPos(c);
    setTrail((tr) => [...tr, ...path]);
    const tx = (c % n) * cell;
    const ty = Math.floor(c / n) * cell;
    if (reduce) {
      x.set(tx);
      y.set(ty);
    } else {
      const cfgSpring = { damping: 18, stiffness: 260, mass: 0.7 };
      x.set(withSpring(tx, cfgSpring));
      y.set(withSpring(ty, cfgSpring));
      // Stretch along the run, squash on arrival.
      squash.value = withSequence(withTiming(1, { duration: 90 }), withDelay(60 + path.length * 40, withSpring(0, spring.bouncy)));
    }

    const hit = path.filter((p) => stars.includes(p) && !gotRef.current.includes(p));
    if (hit.length) {
      gotRef.current = [...gotRef.current, ...hit];
      setGot(gotRef.current);
      fx.combo();
    } else {
      fx.key();
    }

    if (c === goal) {
      finishTimer.current = setTimeout(() => {
        fx.win();
        if (!reduce) cheer.value = withSequence(withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(0, spring.bouncy));
        const time = Math.max(1, Math.round((Date.now() - (started.current ?? Date.now())) / 1000));
        const score = Math.max(1, time - gotRef.current.length * STAR_BONUS);
        setSeconds(time);
        setDone({ record: cfg.scored && best.submit(score, true), time, score });
      }, 260 + path.length * 40);
    }
  };

  // Swipes on the board. A long drag that turns a corner fires again, so you can "draw" a route.
  const moveRef = useRef(move);
  const critterAt = useRef({ cx: 0, cy: 0, cell: 0 });
  useEffect(() => {
    moveRef.current = move;
    critterAt.current = { cx: (pos % n) * cell + cell / 2, cy: Math.floor(pos / n) * cell + cell / 2, cell };
  });
  const drag = useRef({ ox: 0, oy: 0, fired: false, lx: 0, ly: 0 });
  // The refs are only read inside the gesture callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        drag.current = { ox: 0, oy: 0, fired: false, lx: e.nativeEvent.locationX, ly: e.nativeEvent.locationY };
      },
      onPanResponderMove: (_e, g: PanResponderGestureState) => {
        const dx = g.dx - drag.current.ox;
        const dy = g.dy - drag.current.oy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
        const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        drag.current = { ...drag.current, ox: g.dx, oy: g.dy, fired: true };
        moveRef.current(d, true);
      },
      onPanResponderRelease: (_e, g: PanResponderGestureState) => {
        if (drag.current.fired || Math.abs(g.dx) + Math.abs(g.dy) > 12) return;
        // A tap: head toward it from the critter (helps little fingers that tap instead of swipe).
        const { cx, cy, cell: s } = critterAt.current;
        const dx = drag.current.lx - cx;
        const dy = drag.current.ly - cy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < s * 0.5) return;
        moveRef.current(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up', true);
      },
      onPanResponderTerminationRequest: () => false,
    }),
  );

  const walls = useMemo(() => (cell > 0 ? wallPath(cells, n, cell) : ''), [cells, n, cell]);
  const trailD = useMemo(() => trail.map((c, i) => `${i ? 'L' : 'M'}${(c % n) * cell + cell / 2} ${Math.floor(c / n) * cell + cell / 2}`).join(''), [trail, n, cell]);
  const hint = useMemo(() => (cfg.hint && !done ? route(cells, n, pos, goal).slice(0, -1) : []), [cfg.hint, done, cells, n, pos, goal]);

  const critterStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value + nudgeX.value },
      { translateY: y.value + nudgeY.value - cheer.value * cell * 0.5 },
      { scaleX: face.value * (1 + 0.14 * squash.value) },
      { scaleY: 1 - 0.12 * squash.value + 0.15 * cheer.value },
    ],
  }));

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const prev = best.read();

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GameBar>
        {cfg.clock && <Readout label={t('play.readout.time')} value={fmt(seconds)} />}
        {cfg.stars > 0 && <Readout label={t('maze.readout.stars')} value={`${got.length}/${cfg.stars}`} />}
      </GameBar>

      <View style={[styles.body, { paddingTop: top, paddingBottom: insets.bottom + space.xl }]}>
        {board > 0 && (
          <View style={[styles.boardWrap, { width: board + wall * 2 + space.md * 2, height: board + wall * 2 + space.md * 2 }]}>
            <View
              style={{ width: board, height: board }}
              {...pan.panHandlers}
              accessible
              accessibilityLabel={t('maze.board')}
              accessibilityActions={DIRS.map((d) => ({ name: d, label: t(`maze.${d}`) }))}
              onAccessibilityAction={(e) => move(e.nativeEvent.actionName as Dir, true)}
            >
              <Svg width={board} height={board} style={StyleSheet.absoluteFill}>
                <Path d={trailD} stroke={alpha(tint, 0.22)} strokeWidth={cell * 0.34} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <Rect x={(n - 1) * cell + cell * 0.1} y={(n - 1) * cell + cell * 0.1} width={cell * 0.8} height={cell * 0.8} rx={cell * 0.24} fill={alpha(color.reward, 0.14)} />
                <Path d={walls} stroke={tint} strokeWidth={wall} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>

              {hint.map((c, i) => (
                <Crumb key={c} index={i} x={(c % n) * cell} y={Math.floor(c / n) * cell} cell={cell} />
              ))}
              {stars.map((c) => (
                <StarItem key={c} x={(c % n) * cell} y={Math.floor(c / n) * cell} cell={cell} taken={got.includes(c)} />
              ))}
              <Home x={(n - 1) * cell} y={(n - 1) * cell} cell={cell} />

              <Animated.View pointerEvents="none" style={[styles.critter, { width: cell, height: cell }, critterStyle]}>
                <Text style={{ fontSize: Math.max(16, cell * 0.64) }}>{critter}</Text>
              </Animated.View>

              {done && <Confetti x={(n - 0.5) * cell} y={(n - 0.5) * cell} count={36} spread={1.1} />}
            </View>
          </View>
        )}

        <Pad onMove={(d) => move(d, false)} />
      </View>

      {done && (
        <Finish
          title={lane === 'little' ? t('maze.home') : t('maze.madeIt')}
          lines={
            !cfg.scored
              ? [`${critter} ${HOME}`]
              : [
                  t('maze.timeLine', { time: fmt(done.time) }),
                  ...(got.length ? [t('maze.starBonus', { s: got.length * STAR_BONUS }), t('maze.final', { time: fmt(done.score) })] : []),
                  ...(prev != null && !done.record ? [t('play.best', { n: fmt(prev) })] : []),
                ]
          }
          record={done.record}
          onAgain={onAgain}
        />
      )}
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

// ── pieces ───────────────────────────────────────────────────────────────────

/** Little's breadcrumbs: glowing dots along the way home, pulsing in a wave toward the house. */
function Crumb({ index, x, y, cell }: { index: number; x: number; y: number; cell: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 0.6 : 0);
  useEffect(() => {
    if (reduce) return;
    p.value = withDelay(index * 140, withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(0.25, { duration: 700 })), -1, false));
  }, [index, reduce, p]);
  const dot = cell * 0.2;
  const glow = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * p.value, transform: [{ scale: 0.8 + 0.5 * p.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.crumbBox, { left: x, top: y, width: cell, height: cell }, glow]}>
      <View style={{ position: 'absolute', width: dot * 2.4, height: dot * 2.4, borderRadius: dot * 1.2, backgroundColor: alpha(color.reward, 0.22) }} />
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color.reward }} />
    </Animated.View>
  );
}

function StarItem({ x, y, cell, taken }: { x: number; y: number; cell: number; taken: boolean }) {
  const reduce = useReducedMotion();
  const spin = useSharedValue(0);
  const gone = useSharedValue(0);
  useEffect(() => {
    if (!reduce) spin.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, spin]);
  useEffect(() => {
    if (taken) gone.value = reduce ? 1 : withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
  }, [taken, reduce, gone]);
  const anim = useAnimatedStyle(() => ({
    opacity: 1 - gone.value,
    transform: [{ translateY: -cell * 0.8 * gone.value }, { scale: (0.9 + 0.12 * spin.value) * (1 + 0.8 * gone.value) }, { rotate: `${(spin.value - 0.5) * 16}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.cellBox, { left: x, top: y, width: cell, height: cell }, anim]}>
      <Text style={{ fontSize: Math.max(14, cell * 0.55) }}>⭐</Text>
    </Animated.View>
  );
}

/** Home, breathing a warm glow so the goal is obvious at a glance. */
function Home({ x, y, cell }: { x: number; y: number; cell: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!reduce) p.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, p]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 - 0.35 * p.value, transform: [{ scale: 0.75 + 0.35 * p.value }] }));
  const bob = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * p.value }] }));
  return (
    <View pointerEvents="none" style={[styles.cellBox, { left: x, top: y, width: cell, height: cell }]}>
      <Animated.View style={[{ position: 'absolute', width: cell * 0.95, height: cell * 0.95, borderRadius: cell, backgroundColor: alpha(color.reward, 0.35) }, ring]} />
      <Animated.Text style={[{ fontSize: Math.max(16, cell * 0.6) }, bob]}>{HOME}</Animated.Text>
    </View>
  );
}

/** The big arrow pad under the board: a plus of four ledge buttons. */
function Pad({ onMove }: { onMove: (d: Dir) => void }) {
  return (
    <View style={styles.pad}>
      <Arrow dir="up" onMove={onMove} />
      <View style={styles.padRow}>
        <Arrow dir="left" onMove={onMove} />
        <Arrow dir="down" onMove={onMove} />
        <Arrow dir="right" onMove={onMove} />
      </View>
    </View>
  );
}

const ROT: Record<Dir, string> = { up: '0deg', right: '90deg', down: '180deg', left: '-90deg' };

function Arrow({ dir, onMove }: { dir: Dir; onMove: (d: Dir) => void }) {
  const { t } = useT();
  const press = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * LEDGE }] }));
  return (
    <Pressable
      onPress={() => onMove(dir)}
      onPressIn={() => (press.value = withSpring(1, spring.snappy))}
      onPressOut={() => (press.value = withSpring(0, spring.bouncy))}
      accessibilityRole="button"
      accessibilityLabel={t(`maze.${dir}`)}
      style={{ paddingBottom: LEDGE }}
    >
      <View style={styles.arrowLedge} />
      <Animated.View style={[styles.arrow, anim]}>
        <Svg width={30} height={30} viewBox="0 0 24 24" style={{ transform: [{ rotate: ROT[dir] }] }}>
          <Path d="M5 15l7-7 7 7" stroke={color.text} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

// ── Play-tab card ────────────────────────────────────────────────────────────

const TINT = lanes.adult.color;
const SCENE_COLS = 5;
const SCENE_ROWS = 3;
const SCENE_CELL = 30;
const SCENE_W = SCENE_COLS * SCENE_CELL + 12;
const SCENE_H = SCENE_ROWS * SCENE_CELL + 12;
/** A hand-made snake through the 5 × 3 grid; every cell is on it, so it doubles as a perfect maze. */
const SCENE_PATH: [number, number][] = [
  [0, 0], [1, 0], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [3, 0], [4, 0], [4, 1], [3, 1], [3, 2], [4, 2],
];
const SCENE_XS = SCENE_PATH.map(([cx]) => cx * SCENE_CELL);
const SCENE_YS = SCENE_PATH.map(([, cy]) => cy * SCENE_CELL);
const SCENE_WALLS = (() => {
  const open = new Set<string>();
  for (let i = 1; i < SCENE_PATH.length; i++) {
    const [a, b] = [SCENE_PATH[i - 1], SCENE_PATH[i]];
    open.add(`${a[0]},${a[1]}|${b[0]},${b[1]}`);
    open.add(`${b[0]},${b[1]}|${a[0]},${a[1]}`);
  }
  const s = SCENE_CELL;
  let d = `M0 0H${SCENE_COLS * s}V${SCENE_ROWS * s}H0Z`;
  for (let cy = 0; cy < SCENE_ROWS; cy++)
    for (let cx = 0; cx < SCENE_COLS; cx++) {
      if (cx < SCENE_COLS - 1 && !open.has(`${cx},${cy}|${cx + 1},${cy}`)) d += `M${(cx + 1) * s} ${cy * s}V${(cy + 1) * s}`;
      if (cy < SCENE_ROWS - 1 && !open.has(`${cx},${cy}|${cx},${cy + 1}`)) d += `M${cx * s} ${(cy + 1) * s}H${(cx + 1) * s}`;
    }
  return d;
})();
const SCENE_TRAIL = SCENE_PATH.map(([cx, cy], i) => `${i ? 'L' : 'M'}${cx * SCENE_CELL + SCENE_CELL / 2} ${cy * SCENE_CELL + SCENE_CELL / 2}`).join('');

export const mazeRunMeta: GameMeta = {
  id: 'maze',
  name: 'maze.name',
  sub: (lane, t) => {
    const { n, clock, stars } = MAZE[lane];
    if (lane === 'little') return t('maze.subLittle');
    if (stars) return t('maze.subStars', { n });
    return t(clock ? 'maze.subTimed' : 'maze.sub', { n });
  },
  tint: TINT,
  Scene: MazeScene,
  best: {
    format: (n) => fmt(n),
    // Lower is better: seconds per row of maze.
    stars: (n, lane) => {
      const per = n / MAZE[lane].n;
      return per <= 2 ? 3 : per <= 4 ? 2 : 1;
    },
    hiddenFor: ['little'],
  },
};

/** A fox scampers cell by cell through a tiny maze to its house, then hops and starts over. */
function MazeScene({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const k = box.w ? Math.min(box.w / SCENE_W, box.h / SCENE_H) * 0.92 : 0;
  const t = useSharedValue(reduce ? 1 : 0);
  const hop = useSharedValue(0);

  useEffect(() => {
    if (reduce || !active) return;
    t.value = 0;
    t.value = withRepeat(withSequence(withTiming(1, { duration: 5200, easing: Easing.linear }), withDelay(1100, withTiming(0, { duration: 0 }))), -1, false);
    hop.value = withRepeat(
      withSequence(withDelay(5200, withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) })), withSpring(0, spring.bouncy), withDelay(500, withTiming(0, { duration: 0 }))),
      -1,
      false,
    );
  }, [active, reduce, t, hop]);

  const fox = useAnimatedStyle(() => {
    const last = SCENE_XS.length - 1;
    const f = t.value * last;
    const i = Math.min(last - 1, Math.floor(f));
    // Ease each hop between cells so it reads as stepping, not gliding.
    const r = f - i;
    const e = r * r * (3 - 2 * r);
    const px = SCENE_XS[i] + (SCENE_XS[i + 1] - SCENE_XS[i]) * e;
    const py = SCENE_YS[i] + (SCENE_YS[i + 1] - SCENE_YS[i]) * e;
    const dir = SCENE_XS[i + 1] < SCENE_XS[i] ? -1 : 1;
    return { transform: [{ translateX: px }, { translateY: py - 10 * hop.value - Math.sin(r * Math.PI) * 3 }, { scaleX: dir }] };
  });
  const trail = useAnimatedStyle(() => ({ opacity: 0.5 + 0.5 * t.value }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.sceneCenter]} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 340 170" preserveAspectRatio="xMidYMid slice">
        <Circle cx={24} cy={28} r={6} fill={color.ink} opacity={0.15} />
        <Circle cx={316} cy={34} r={8} fill={color.ink} opacity={0.15} />
        <Circle cx={306} cy={146} r={5} fill={color.ink} opacity={0.15} />
        <Circle cx={36} cy={142} r={7} fill={color.ink} opacity={0.15} />
      </Svg>
      {k > 0 && (
        <View style={{ width: SCENE_W, height: SCENE_H, padding: 6, transform: [{ scale: k }] }}>
          <View style={{ width: SCENE_COLS * SCENE_CELL, height: SCENE_ROWS * SCENE_CELL }}>
            <Animated.View style={[StyleSheet.absoluteFill, trail]}>
              <Svg width={SCENE_COLS * SCENE_CELL} height={SCENE_ROWS * SCENE_CELL}>
                <Path d={SCENE_TRAIL} stroke={color.ink} strokeOpacity={0.14} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </Animated.View>
            <Svg width={SCENE_COLS * SCENE_CELL} height={SCENE_ROWS * SCENE_CELL} style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}>
              <Path d={SCENE_WALLS} stroke={color.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
            <View style={[styles.sceneCell, { left: 4 * SCENE_CELL, top: 2 * SCENE_CELL }]}>
              <Text style={{ fontSize: 19 }}>{HOME}</Text>
            </View>
            <Animated.View style={[styles.sceneCell, fox]}>
              <Text style={{ fontSize: 19 }}>🦊</Text>
            </Animated.View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  body: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: space.lg },
  boardWrap: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.video, backgroundColor: color.surface1, borderWidth: 2, borderColor: color.line },
  critter: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  crumbBox: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  cellBox: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pad: { alignItems: 'center', gap: space.sm },
  padRow: { flexDirection: 'row', gap: space.sm },
  arrowLedge: { position: 'absolute', left: 0, right: 0, top: LEDGE, bottom: 0, borderRadius: 20, backgroundColor: color.line },
  arrow: { width: PAD_BTN, height: PAD_BTN, borderRadius: 20, borderWidth: 2, borderColor: color.line, backgroundColor: color.surface1, alignItems: 'center', justifyContent: 'center' },
  sceneCenter: { alignItems: 'center', justifyContent: 'center' },
  sceneCell: { position: 'absolute', left: 0, top: 0, width: SCENE_CELL, height: SCENE_CELL, alignItems: 'center', justifyContent: 'center' },
});
