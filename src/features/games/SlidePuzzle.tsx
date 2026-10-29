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
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { TimesUp } from '@/features/library/TimesUp';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { alpha, color, font, Lane, lane as lanes, media, pageFill, radius, space, themedStyles } from '@/theme/tokens';

import { Confetti } from './Confetti';
import { Finish, GameBar, Readout } from './GameChrome';
import { useBest, useGameSession } from './shared';
import type { GameMeta, GameProps } from './types';

/**
 * Per-lane tuning. `mix` is how many random legal moves scramble the solved
 * picture (so every board is solvable). Little gets a 2×2 nudged a few times,
 * no clock, no numbers; older lanes get a bigger board and a clock.
 */
export const SLIDE: Record<Lane, { n: number; mix: [number, number]; timed: boolean; numbers: boolean }> = {
  little: { n: 2, mix: [3, 5], timed: false, numbers: false },
  kids: { n: 3, mix: [24, 34], timed: false, numbers: true },
  teen: { n: 3, mix: [60, 80], timed: true, numbers: true },
  adult: { n: 4, mix: [120, 160], timed: true, numbers: true },
};

const GAP = 6;
const LEDGE = 4;
const SHOW_MS = 1300; // the finished picture, before it breaks apart
const FINISH_MS = 1500; // celebration before the end card

type Kind = 'bear' | 'cat' | 'bunny';
const KINDS: Kind[] = ['bear', 'cat', 'bunny'];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** board[cell] = tile id, -1 = the gap. Solved = tile i sits in cell i, gap last. */
const solvedBoard = (n: number) => Array.from({ length: n * n }, (_, i) => (i === n * n - 1 ? -1 : i));
const isSolved = (b: number[]) => b.every((v, i) => (i === b.length - 1 ? v === -1 : v === i));

function neighbours(cell: number, n: number) {
  const r = Math.floor(cell / n);
  const c = cell % n;
  const out: number[] = [];
  if (r > 0) out.push(cell - n);
  if (r < n - 1) out.push(cell + n);
  if (c > 0) out.push(cell - 1);
  if (c < n - 1) out.push(cell + 1);
  return out;
}

/** Walk the gap around at random (never straight back) — always solvable. */
function scramble(n: number, [lo, hi]: [number, number]) {
  const b = solvedBoard(n);
  let gap = n * n - 1;
  let prev = -1;
  const want = lo + Math.floor(Math.random() * (hi - lo + 1));
  for (let step = 0; step < want || isSolved(b); step++) {
    const opts = neighbours(gap, n).filter((c) => c !== prev);
    const c = opts[Math.floor(Math.random() * opts.length)];
    b[gap] = b[c];
    b[c] = -1;
    prev = gap;
    gap = c;
  }
  return b;
}

/** A darker edge of the same colour for the ledge (same rule as Chip). */
function shade(hex: string, k = 0.62) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

type Phase = 'show' | 'play' | 'solved';

/** One Slide Puzzle board. Remount (new key) to deal again. */
export function SlidePuzzle({ lane, onAgain }: GameProps) {
  const cfg = SLIDE[lane];
  const n = cfg.n;
  const tint = lanes[lane].color;
  const { lock } = useGameSession('slide');
  const best = useBest('slide', lane);
  const { t } = useT();
  const reduce = useReducedMotion();

  const [kind] = useState<Kind>(() => KINDS[Math.floor(Math.random() * KINDS.length)]);
  const [mixed] = useState(() => scramble(n, cfg.mix));
  const [board, setBoard] = useState<number[]>(() => solvedBoard(n));
  const [phase, setPhase] = useState<Phase>('show');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const [done, setDone] = useState<{ record: boolean } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Show the finished picture, then break it apart into the scramble.
  useEffect(() => {
    if (size.w === 0 || phase !== 'show') return;
    const id = setTimeout(() => {
      fx.flip();
      setBoard(mixed);
      setPhase('play');
    }, SHOW_MS);
    return () => clearTimeout(id);
  }, [size.w > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // The clock starts on the first slide, so looking at the board is free.
  useEffect(() => {
    if (!cfg.timed || !started || phase !== 'play' || lock) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [cfg.timed, started, phase, lock]);

  /** Slide the tile in `cell` (and any tiles between it and the gap). False when it can't move. */
  const tap = (cell: number): boolean => {
    if (phase !== 'play' || lock) return false;
    const g = board.indexOf(-1);
    const r = Math.floor(cell / n);
    const c = cell % n;
    const gr = Math.floor(g / n);
    const gc = g % n;
    if (cell === g || (r !== gr && c !== gc)) {
      fx.tap();
      return false;
    }
    const step = r === gr ? (gc > c ? 1 : -1) : gr > r ? n : -n;
    const next = [...board];
    const moved: number[] = [];
    for (let k = g; k !== cell; k -= step) {
      next[k] = next[k - step];
      moved.push(next[k]);
    }
    next[cell] = -1;
    const count = moves + moved.length;
    setBoard(next);
    setMoves(count);
    if (!started) setStarted(true);

    if (isSolved(next)) {
      setPhase('solved');
      fx.pop();
      later(() => fx.win(), 260);
      const record = lane === 'little' ? false : best.submit(cfg.timed ? seconds : count, true);
      later(() => setDone({ record }), FINISH_MS);
    } else if (moved.some((id) => next[id] === id)) {
      fx.pop(); // a piece just landed home
    } else {
      fx.flip();
    }
    return true;
  };

  // Fit the board under the bar with room for the peek button.
  const boardPx = Math.max(0, Math.min(size.w - space.lg * 2, size.h - 280, 440));
  const cellPx = (boardPx - GAP * (n - 1)) / n;
  const stepPx = cellPx + GAP;

  return (
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <GameBar>
        {cfg.timed && <Readout label={t('play.readout.time')} value={fmt(seconds)} />}
        {lane !== 'little' && <Readout label={t('play.readout.moves')} value={String(moves)} />}
      </GameBar>

      {boardPx > 0 && (
        <View style={{ alignItems: 'center', gap: space.xl, marginTop: 56 }}>
          <View style={{ width: boardPx, height: boardPx + LEDGE }}>
            {Array.from({ length: n * n }, (_, id) => {
              const isLast = id === n * n - 1;
              const cell = isLast ? n * n - 1 : board.indexOf(id);
              return (
                <Tile
                  key={id}
                  id={id}
                  n={n}
                  cell={cell}
                  px={cellPx}
                  step={stepPx}
                  kind={kind}
                  tint={tint}
                  number={cfg.numbers}
                  hidden={isLast && phase !== 'solved'}
                  home={cell === id}
                  playing={phase === 'play'}
                  solved={phase === 'solved'}
                  onTap={() => tap(cell)}
                />
              );
            })}
            <Whole px={boardPx} kind={kind} tint={tint} show={phase === 'show' || (peeking && phase === 'play')} solved={phase === 'solved'} />
          </View>

          <PeekButton kind={kind} tint={tint} little={lane === 'little'} disabled={phase !== 'play'} onPeek={setPeeking} />
        </View>
      )}

      {done && (
        <>
          {!reduce && <Confetti x={size.w / 2} y={size.h * 0.42} count={48} spread={1.3} />}
          <Finish
            title={lane === 'little' ? t('slide.solvedLittle') : t('slide.solved')}
            lines={cfg.timed ? [`${fmt(seconds)} · ${t('play.moves', { count: moves })}`] : lane === 'little' ? [] : [t('play.moves', { count: moves })]}
            record={done.record}
            onAgain={onAgain}
          />
        </>
      )}
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

type TileProps = {
  id: number;
  n: number;
  cell: number;
  px: number;
  step: number;
  kind: Kind;
  tint: string;
  number: boolean;
  hidden: boolean;
  home: boolean;
  playing: boolean;
  solved: boolean;
  onTap: () => boolean;
};

/** One picture piece: a window onto the whole drawing, sitting on a hard ledge. */
function Tile({ id, n, cell, px, step, kind, tint, number, hidden, home, playing, solved, onTap }: TileProps) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const col = cell % n;
  const row = Math.floor(cell / n);
  const x = useSharedValue(col * step);
  const y = useSharedValue(row * step);
  const press = useSharedValue(0);
  const wiggle = useSharedValue(0);
  const pop = useSharedValue(1);
  const shown = useSharedValue(hidden ? 0 : 1);

  useEffect(() => {
    x.value = reduce ? col * step : withSpring(col * step, spring.snappy);
    y.value = reduce ? row * step : withSpring(row * step, spring.snappy);
  }, [col, row, step, reduce, x, y]);

  // Landing home mid-game: a little hop. Solved: everyone bounces once, in a wave from the top-left.
  const wasHome = useRef(home);
  useEffect(() => {
    if (!reduce) {
      if (solved) pop.value = withDelay(220 + (col + row) * 50, withSequence(withTiming(1.1, { duration: 120 }), withSpring(1, spring.bouncy)));
      else if (home && !wasHome.current && playing) pop.value = withDelay(90, withSequence(withTiming(1.08, { duration: 110 }), withSpring(1, spring.bouncy)));
    }
    wasHome.current = home;
  }, [home, playing, solved, reduce, col, row, pop]);

  // The missing piece drops in when the picture is complete.
  useEffect(() => {
    shown.value = reduce ? (hidden ? 0 : 1) : hidden ? withTiming(0, { duration: 160 }) : withDelay(140, withSpring(1, spring.bouncy));
  }, [hidden, reduce, shown]);

  const shell = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: pop.value * (0.4 + 0.6 * shown.value) }, { rotate: `${wiggle.value}deg` }],
  }));
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * LEDGE }] }));

  const homeCol = id % n;
  const homeRow = Math.floor(id / n);
  const r = Math.max(8, px * 0.12);

  return (
    <Animated.View pointerEvents={hidden ? 'none' : 'auto'} style={[styles.tile, { width: px, height: px + LEDGE }, shell]}>
      <Pressable
        onPressIn={() => (press.value = withSpring(1, spring.snappy))}
        onPressOut={() => (press.value = withSpring(0, spring.bouncy))}
        onPress={() => {
          if (!onTap() && !reduce && playing) {
            wiggle.value = withSequence(withTiming(-5, { duration: 50 }), withTiming(5, { duration: 70 }), withTiming(-3, { duration: 60 }), withSpring(0, spring.snappy));
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={t('slide.tile', { n: id + 1 })}
        style={{ width: px, height: px + LEDGE }}
      >
        <View style={[styles.ledge, { top: LEDGE, width: px, height: px, borderRadius: r, backgroundColor: shade(tint, 0.45) }]} />
        <Animated.View style={[styles.face, { width: px, height: px, borderRadius: r }, face]}>
          <View style={{ position: 'absolute', left: -homeCol * px, top: -homeRow * px }}>
            <Picture px={px * n} kind={kind} tint={tint} happy={solved} />
          </View>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: r, borderWidth: 2, borderColor: shade(tint, 0.5) }]} />
          {number && (
            <View style={[styles.badge, { top: 5, left: 5, minWidth: Math.max(20, px * 0.2), height: Math.max(20, px * 0.2), borderRadius: Math.max(10, px * 0.1) }]}>
              <Text style={[styles.badgeText, { fontSize: Math.max(11, px * 0.11) }]}>{id + 1}</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** The whole picture, laid over the board: at the start, while peeking, and at the end. */
function Whole({ px, kind, tint, show, solved }: { px: number; kind: Kind; tint: string; show: boolean; solved: boolean }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(show ? 1 : 0);
  const s = useSharedValue(reduce ? 1 : 0.85);

  useEffect(() => {
    if (solved) {
      // At the end the pieces fuse back into one picture and it jumps for joy.
      o.value = withDelay(reduce ? 0 : 750, withTiming(1, { duration: reduce ? 0 : 220 }));
      if (!reduce) s.value = withDelay(750, withSequence(withTiming(1.05, { duration: 160 }), withSpring(1, spring.bouncy)));
      return;
    }
    o.value = reduce ? (show ? 1 : 0) : withTiming(show ? 1 : 0, { duration: show ? 140 : 180 });
    if (!reduce && s.value < 1) s.value = withSpring(1, spring.smooth); // the first reveal
  }, [show, solved, reduce, o, s]);

  const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.whole, { width: px, height: px, borderColor: shade(tint, 0.5) }, anim]}>
      <Picture px={px} kind={kind} tint={tint} happy={solved} />
    </Animated.View>
  );
}

/** Hold to see the finished picture. Little gets a big thumbnail, no words. */
function PeekButton({ kind, tint, little, disabled, onPeek }: { kind: Kind; tint: string; little: boolean; disabled: boolean; onPeek: (on: boolean) => void }) {
  const { t } = useT();
  const press = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * 3 }] }));
  const thumb = little ? 56 : 32;
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        press.value = withSpring(1, spring.snappy);
        fx.flip();
        onPeek(true);
      }}
      onPressOut={() => {
        press.value = withSpring(0, spring.bouncy);
        onPeek(false);
      }}
      accessibilityRole="button"
      accessibilityLabel={t('slide.peek')}
      accessibilityHint={t('slide.peekHint')}
      style={{ paddingBottom: 3, opacity: disabled ? 0.4 : 1 }}
    >
      <View style={[styles.peekLedge, { top: 3 }]} />
      <Animated.View style={[styles.peek, little && { paddingHorizontal: 10 }, face]}>
        <View style={[styles.thumb, { width: thumb, height: thumb, borderRadius: thumb * 0.22, borderColor: shade(tint, 0.5) }]}>
          <Picture px={thumb} kind={kind} tint={tint} happy={false} />
        </View>
        {!little && <Text style={styles.peekText}>{t('slide.peek')}</Text>}
      </Animated.View>
    </Pressable>
  );
}

/**
 * The puzzle picture: a chunky critter on a starry night, drawn in the
 * player's lane colour with an ink outline and white glints. Every corner has
 * something in it (stars, flowers, the hill) so no piece is a blank square.
 */
function Picture({ px, kind, tint, happy }: { px: number; kind: Kind; tint: string; happy: boolean }) {
  const ink = color.ink;
  const inner = alpha(color.ink, 0.25);
  const spark = (x: number, y: number, s: number) => `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;
  return (
    <Svg width={px} height={px} viewBox="0 0 100 100">
      <Rect x={0} y={0} width={100} height={100} fill={color.surface2} />
      <Circle cx={50} cy={54} r={46} fill={alpha(tint, 0.1)} />
      <Circle cx={50} cy={54} r={37} fill={alpha(tint, 0.12)} />
      <Path d={spark(13, 14, 6)} fill={color.reward} />
      <Path d={spark(87, 17, 4.5)} fill={color.reward} />
      <Circle cx={22} cy={7} r={1.6} fill={color.text} />
      <Circle cx={93} cy={40} r={1.4} fill={color.text} />
      <Circle cx={7} cy={44} r={1.4} fill={color.text} />
      <Path d={spark(9, 66, 3)} fill={color.text} />
      <Path d={spark(92, 70, 3.2)} fill={color.reward} />
      <Ellipse cx={50} cy={106} rx={66} ry={20} fill={alpha(tint, 0.3)} />
      {/* flowers in the bottom corners */}
      <G>
        <Circle cx={10} cy={93} r={3.6} fill={color.text} />
        <Circle cx={10} cy={93} r={1.5} fill={color.reward} />
        <Circle cx={90} cy={92} r={3.6} fill={color.text} />
        <Circle cx={90} cy={92} r={1.5} fill={color.reward} />
      </G>

      {/* body + paws */}
      <Ellipse cx={50} cy={97} rx={27} ry={17} fill={tint} stroke={ink} strokeWidth={3} />
      <Ellipse cx={50} cy={98} rx={12} ry={8} fill={alpha(color.white, 0.55)} />
      <Circle cx={36} cy={91} r={6} fill={tint} stroke={ink} strokeWidth={2.6} />
      <Circle cx={64} cy={91} r={6} fill={tint} stroke={ink} strokeWidth={2.6} />

      {/* ears */}
      {kind === 'bear' && (
        <G>
          <Circle cx={26} cy={27} r={12} fill={tint} stroke={ink} strokeWidth={3.2} />
          <Circle cx={74} cy={27} r={12} fill={tint} stroke={ink} strokeWidth={3.2} />
          <Circle cx={27} cy={28} r={6} fill={inner} />
          <Circle cx={73} cy={28} r={6} fill={inner} />
        </G>
      )}
      {kind === 'cat' && (
        <G strokeLinejoin="round">
          <Path d="M20 40 L24 10 L46 27 Z" fill={tint} stroke={ink} strokeWidth={3.2} />
          <Path d="M80 40 L76 10 L54 27 Z" fill={tint} stroke={ink} strokeWidth={3.2} />
          <Path d="M26 33 L28 19 L38 27 Z" fill={inner} />
          <Path d="M74 33 L72 19 L62 27 Z" fill={inner} />
        </G>
      )}
      {kind === 'bunny' && (
        <G>
          <G transform="rotate(-12 36 22)">
            <Ellipse cx={36} cy={18} rx={8} ry={19} fill={tint} stroke={ink} strokeWidth={3.2} />
            <Ellipse cx={36} cy={19} rx={3.5} ry={12} fill={inner} />
          </G>
          <G transform="rotate(12 64 22)">
            <Ellipse cx={64} cy={18} rx={8} ry={19} fill={tint} stroke={ink} strokeWidth={3.2} />
            <Ellipse cx={64} cy={19} rx={3.5} ry={12} fill={inner} />
          </G>
        </G>
      )}

      {/* head */}
      <Ellipse cx={50} cy={53} rx={34} ry={30} fill={tint} stroke={ink} strokeWidth={3.5} />
      <Path d="M24 42 Q28 31 39 27" stroke={color.white} strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.85} />

      {/* eyes: open, or squeezed shut with joy when the picture is done */}
      {happy ? (
        <G stroke={ink} strokeWidth={3.6} strokeLinecap="round" fill="none">
          <Path d="M31 52 Q38 43 45 52" />
          <Path d="M55 52 Q62 43 69 52" />
        </G>
      ) : (
        <G>
          <Circle cx={38} cy={50} r={7.5} fill={color.white} stroke={ink} strokeWidth={2.6} />
          <Circle cx={62} cy={50} r={7.5} fill={color.white} stroke={ink} strokeWidth={2.6} />
          <Circle cx={39} cy={51} r={4.2} fill={ink} />
          <Circle cx={63} cy={51} r={4.2} fill={ink} />
          <Circle cx={40.6} cy={49.2} r={1.6} fill={color.white} />
          <Circle cx={64.6} cy={49.2} r={1.6} fill={color.white} />
        </G>
      )}

      <Ellipse cx={27} cy={63} rx={5.5} ry={3.5} fill={alpha(color.danger, 0.6)} />
      <Ellipse cx={73} cy={63} rx={5.5} ry={3.5} fill={alpha(color.danger, 0.6)} />

      {/* muzzle */}
      <Ellipse cx={50} cy={65} rx={12.5} ry={9} fill={media.text} stroke={ink} strokeWidth={2.6} />
      <Ellipse cx={50} cy={61} rx={4.6} ry={3.2} fill={ink} />
      {happy ? (
        <Path d="M43.5 66 Q50 76 56.5 66 Z" fill={ink} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
      ) : (
        <Path d="M44 66 Q50 71.5 56 66" stroke={ink} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      )}
      {kind === 'bunny' && <Rect x={47.6} y={67} width={4.8} height={4} rx={1} fill={color.white} stroke={ink} strokeWidth={1.4} />}
      {kind === 'cat' && (
        <G stroke={ink} strokeWidth={2} strokeLinecap="round">
          <Path d="M20 62 L8 59" />
          <Path d="M20 67 L8 68" />
          <Path d="M80 62 L92 59" />
          <Path d="M80 67 L92 68" />
        </G>
      )}
    </Svg>
  );
}

// ── Play-tab card ────────────────────────────────────────────────────────────

const CYCLE = [4, 5, 8, 7]; // the gap walks round the bottom-right square
const MINI = 28;
const MINI_GAP = 3;

/** A little 3×3 picture board with one piece after another sliding into the gap. */
function SlideScene({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [b, setB] = useState<number[]>(() => [0, 1, 2, 3, 4, 5, 6, 7, -1]);
  useEffect(() => {
    if (!active || reduce) return;
    const id = setInterval(
      () =>
        setB((cur) => {
          // The gap walks backwards round the square; the piece behind it slides in.
          const gi = CYCLE.indexOf(cur.indexOf(-1));
          const from = CYCLE[(gi + 3) % 4];
          const next = [...cur];
          next[CYCLE[gi]] = cur[from];
          next[from] = -1;
          return next;
        }),
      850,
    );
    return () => clearInterval(id);
  }, [active, reduce]);

  return (
    <View style={{ width: MINI * 3 + MINI_GAP * 2, height: MINI * 3 + MINI_GAP * 2 }}>
      {Array.from({ length: 8 }, (_, id) => (
        <MiniTile key={id} id={id} cell={b.indexOf(id)} tint={color.reward} />
      ))}
      <Sparkle active={active} />
    </View>
  );
}

function MiniTile({ id, cell, tint }: { id: number; cell: number; tint: string }) {
  const reduce = useReducedMotion();
  const x = useSharedValue((cell % 3) * (MINI + MINI_GAP));
  const y = useSharedValue(Math.floor(cell / 3) * (MINI + MINI_GAP));
  useEffect(() => {
    const tx = (cell % 3) * (MINI + MINI_GAP);
    const ty = Math.floor(cell / 3) * (MINI + MINI_GAP);
    x.value = reduce ? tx : withSpring(tx, spring.snappy);
    y.value = reduce ? ty : withSpring(ty, spring.snappy);
  }, [cell, reduce, x, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  return (
    <Animated.View style={[styles.mini, anim]}>
      <View style={{ position: 'absolute', left: -(id % 3) * MINI, top: -Math.floor(id / 3) * MINI }}>
        <Picture px={MINI * 3} kind="cat" tint={tint} happy={false} />
      </View>
    </Animated.View>
  );
}

function Sparkle({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!active || reduce) return;
    p.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [active, reduce, p]);
  const anim = useAnimatedStyle(() => ({ opacity: 0.5 + 0.5 * p.value, transform: [{ scale: 0.8 + 0.4 * p.value }, { rotate: `${p.value * 45}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', right: -16, top: -12 }, anim]}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d="M12 1Q12 12 23 12Q12 12 12 23Q12 12 1 12Q12 12 12 1Z" fill={color.white} stroke={color.ink} strokeWidth={1.6} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

export const slidePuzzleMeta: GameMeta = {
  id: 'slide',
  name: 'slide.name',
  sub: (lane, t) => {
    const c = SLIDE[lane];
    if (lane === 'little') return t('slide.subLittle');
    return c.timed ? t('slide.subTimed', { n: c.n }) : t('slide.sub', { n: c.n });
  },
  tint: lanes.little.color,
  Scene: SlideScene,
  best: {
    // Lower is better for both: moves on the untimed board, seconds on the clock.
    format: (v, lane, t) => (SLIDE[lane].timed ? t('slide.bestTime', { time: fmt(v) }) : t('slide.bestMoves', { count: v })),
    stars: (v, lane) => {
      const [three, two] = lane === 'kids' ? [45, 90] : lane === 'teen' ? [45, 100] : [120, 240];
      return v <= three ? 3 : v <= two ? 2 : 1;
    },
    hiddenFor: ['little'],
  },
};

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill(), alignItems: 'center', justifyContent: 'center' },
  tile: { position: 'absolute', left: 0, top: 0 },
  ledge: { position: 'absolute', left: 0 },
  face: { overflow: 'hidden', backgroundColor: color.surface2 },
  badge: { position: 'absolute', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, backgroundColor: alpha(color.ink, 0.72) },
  badgeText: { color: color.text, fontFamily: font.mono, fontVariant: ['tabular-nums'] },
  whole: { position: 'absolute', left: 0, top: 0, borderRadius: radius.card, borderWidth: 2, overflow: 'hidden', backgroundColor: color.surface2 },
  peekLedge: { position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: radius.pill, backgroundColor: color.line },
  peek: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingLeft: 8, paddingRight: 20, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 2, borderColor: color.line, backgroundColor: color.surface1 },
  thumb: { overflow: 'hidden', borderWidth: 2 },
  peekText: { color: color.text, fontFamily: font.bold, fontSize: 15 },
  mini: { position: 'absolute', left: 0, top: 0, width: MINI, height: MINI, borderRadius: 7, overflow: 'hidden', borderWidth: 2, borderColor: color.ink, backgroundColor: color.surface2 },
}));
