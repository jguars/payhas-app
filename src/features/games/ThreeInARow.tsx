import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { Chip } from '@/components/ui/Chip';
import { Enter } from '@/components/motion/Enter';
import { TimesUp } from '@/features/library/TimesUp';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { alpha, color, font, Lane, lane as lanes, pageFill, radius, size, space, themedStyles } from '@/theme/tokens';

import { Confetti } from './Confetti';
import { Finish, GameBar, Readout } from './GameChrome';
import { CRITTERS, shuffle, useBest, useGameSession } from './shared';
import type { GameMeta, GameProps } from './types';

type Brain = 'random' | 'sharp' | 'sly' | 'perfect';

/**
 * Per-lane tuning. Little always goes first against a mostly-random pal and
 * never hears it lost; Kids meet a pal that takes wins and blocks; Teen a
 * minimax that slips about a quarter of the time; Adult a perfect one (and an
 * optional 4×4 against a shallower search, where a win is possible).
 */
export const THREE: Record<Lane, { brain: Brain; slip: number; think: [number, number]; alternate: boolean; fourByFour: boolean }> = {
  little: { brain: 'random', slip: 0, think: [650, 950], alternate: false, fourByFour: false },
  kids: { brain: 'sharp', slip: 0, think: [550, 900], alternate: true, fourByFour: false },
  teen: { brain: 'sly', slip: 0.25, think: [500, 850], alternate: true, fourByFour: false },
  adult: { brain: 'perfect', slip: 0, think: [450, 800], alternate: true, fourByFour: true },
};

const ROUNDS = 5;
const TO_WIN = 3; // first to three rounds takes a best-of-five
const NEXT_MS = 1900; // the result beat before the next round
const GAP = 10;
const LEDGE = 4;

type Mark = 0 | 1 | 2; // empty, you, buddy
type Result = { winner: Mark; line: number[] | null };

// ── rules + the opponent's brain (pure) ──────────────────────────────────────

const LINES = new Map<number, number[][]>();
/** Every full row, column and diagonal; you need the whole line (3 on 3×3, 4 on 4×4). */
function linesFor(n: number) {
  const hit = LINES.get(n);
  if (hit) return hit;
  const out: number[][] = [];
  for (let r = 0; r < n; r++) out.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) out.push(Array.from({ length: n }, (_, r) => r * n + c));
  out.push(Array.from({ length: n }, (_, i) => i * n + i));
  out.push(Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)));
  LINES.set(n, out);
  return out;
}

function winnerOf(b: Mark[], n: number): Result | null {
  for (const line of linesFor(n)) {
    const first = b[line[0]];
    if (first && line.every((i) => b[i] === first)) return { winner: first, line };
  }
  return b.every((v) => v !== 0) ? { winner: 0, line: null } : null;
}

const empties = (b: Mark[]) => b.flatMap((v, i) => (v === 0 ? [i] : []));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** A square that finishes a line for `who`, if there is one. */
function finishing(b: Mark[], n: number, who: Mark) {
  for (const line of linesFor(n)) {
    const mine = line.filter((i) => b[i] === who).length;
    const open = line.filter((i) => b[i] === 0);
    if (mine === n - 1 && open.length === 1) return open[0];
  }
  return null;
}

/** Full minimax on 3×3 (memoised), scored for buddy: +win, −loss, sooner is stronger. */
const memo = new Map<string, number>();
function minimax(b: Mark[], turn: Mark, depth: number): number {
  const key = b.join('') + turn;
  const hit = memo.get(key);
  if (hit != null) return hit - depth;
  const r = winnerOf(b, 3);
  if (r) return r.winner === 2 ? 10 - depth : r.winner === 1 ? depth - 10 : 0;
  let bestScore = turn === 2 ? -Infinity : Infinity;
  for (const i of empties(b)) {
    b[i] = turn;
    const s = minimax(b, turn === 2 ? 1 : 2, depth + 1);
    b[i] = 0;
    bestScore = turn === 2 ? Math.max(bestScore, s) : Math.min(bestScore, s);
  }
  memo.set(key, bestScore + depth);
  return bestScore;
}

/** Each open square with its minimax score for buddy. */
function scored(b: Mark[]) {
  const work = [...b];
  return empties(work).map((i) => {
    work[i] = 2;
    const s = minimax(work, 1, 1);
    work[i] = 0;
    return { i, s };
  });
}

/** 4×4: alpha-beta a few plies deep with a "how open are the lines" guess at the leaves. */
const WEIGHT = [0, 1, 6, 40];
function heuristic(b: Mark[]) {
  let s = 0;
  for (const line of linesFor(4)) {
    let a = 0;
    let p = 0;
    for (const i of line) {
      if (b[i] === 2) a++;
      else if (b[i] === 1) p++;
    }
    if (a && !p) s += WEIGHT[a];
    else if (p && !a) s -= WEIGHT[p] * 1.2;
  }
  return s;
}
function search(b: Mark[], depth: number, alphaIn: number, betaIn: number, turn: Mark): number {
  const r = winnerOf(b, 4);
  if (r) return r.winner === 2 ? 1000 + depth : r.winner === 1 ? -1000 - depth : 0;
  if (depth === 0) return heuristic(b);
  let alphaV = alphaIn;
  let betaV = betaIn;
  for (const i of empties(b)) {
    b[i] = turn;
    const s = search(b, depth - 1, alphaV, betaV, turn === 2 ? 1 : 2);
    b[i] = 0;
    if (turn === 2) alphaV = Math.max(alphaV, s);
    else betaV = Math.min(betaV, s);
    if (alphaV >= betaV) break;
  }
  return turn === 2 ? alphaV : betaV;
}

function chooseMove(b: Mark[], n: number, brain: Brain, slip: number): number {
  const open = empties(b);
  const win = finishing(b, n, 2);
  const block = finishing(b, n, 1);

  if (brain === 'random') {
    // Mostly a coin toss; now and then it notices a win so it still feels like a game.
    if (win != null && Math.random() < 0.25) return win;
    return pick(open);
  }
  if (brain === 'sharp' || n !== 3) {
    if (win != null) return win;
    if (block != null) return block;
    if (n === 3) {
      if (b[4] === 0 && Math.random() < 0.6) return 4;
      return pick(open);
    }
    // 4×4: a shallow search, so a clever fork can beat it.
    let best = -Infinity;
    let moves: number[] = [];
    for (const i of open) {
      b[i] = 2;
      const s = search(b, 2, -Infinity, Infinity, 1);
      b[i] = 0;
      if (s > best) {
        best = s;
        moves = [i];
      } else if (s === best) moves.push(i);
    }
    return pick(moves);
  }

  // 3×3 minimax. An empty board: every opening draws, so vary it.
  if (open.length === 9) return pick([0, 2, 4, 6, 8]);
  const all = scored(b);
  const top = Math.max(...all.map((m) => m.s));
  const best = all.filter((m) => m.s === top).map((m) => m.i);
  const worse = all.filter((m) => m.s < top).map((m) => m.i);
  if (brain === 'sly' && worse.length > 0 && Math.random() < slip) return pick(worse);
  return pick(best);
}

// ── the game ─────────────────────────────────────────────────────────────────

/** One best-of-five match of Three in a Row. Remount (new key) to restart. */
export function ThreeInARow({ lane, onAgain }: GameProps) {
  const cfg = THREE[lane];
  const little = lane === 'little';
  const { lock } = useGameSession('three');
  const best = useBest('three', lane);
  const { t } = useT();
  const reduce = useReducedMotion();

  const [[me, pal]] = useState(() => shuffle(CRITTERS).slice(0, 2));
  const [n, setN] = useState(3);
  const [board, setBoard] = useState<Mark[]>(() => Array(9).fill(0));
  const [turn, setTurn] = useState<Mark>(1);
  const [starter, setStarter] = useState<Mark>(1);
  const [round, setRound] = useState(1);
  const [wins, setWins] = useState<[number, number]>([0, 0]);
  const [result, setResult] = useState<Result | null>(null);
  const [done, setDone] = useState<{ record: boolean } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const fresh = board.every((v) => v === 0) && round === 1 && turn === 1 && !result;

  const place = (cell: number, who: Mark) => {
    const next = [...board];
    next[cell] = who;
    setBoard(next);
    const r = winnerOf(next, n);
    if (!r) {
      if (who === 1) fx.pop();
      else fx.flip();
      setTurn(who === 1 ? 2 : 1);
      return;
    }
    setResult(r);
    setTurn(0);
    // Sound after the line has had a moment to start drawing.
    setTimeout(() => {
      if (r.winner === 1) fx.match();
      else if (r.winner === 2) (little ? fx.success : fx.wrong)();
      else fx.tap();
    }, 180);
  };

  // Buddy's move, after a little think.
  useEffect(() => {
    if (turn !== 2 || result || done || lock) return;
    const [lo, hi] = cfg.think;
    const id = setTimeout(() => place(chooseMove(board, n, cfg.brain, cfg.slip), 2), lo + Math.random() * (hi - lo));
    return () => clearTimeout(id);
  }, [turn, result, done, lock]); // eslint-disable-line react-hooks/exhaustive-deps

  // Between rounds: tally, then the next board or the end card.
  useEffect(() => {
    if (!result || lock) return;
    const nextWins: [number, number] = [wins[0] + (result.winner === 1 ? 1 : 0), wins[1] + (result.winner === 2 ? 1 : 0)];
    const settle = setTimeout(() => setWins(nextWins), 520); // pips fill once the line is drawn
    const id = setTimeout(() => {
      const over = nextWins[0] >= TO_WIN || nextWins[1] >= TO_WIN || round >= ROUNDS;
      if (over) {
        if (nextWins[0] > nextWins[1] || little) fx.win();
        // Adult 3×3 Buddy never loses, so Adults are scored on rounds they didn't lose (draws count).
        const score = lane === 'adult' ? round - nextWins[1] : nextWins[0];
        setDone({ record: !little && score > 0 && best.submit(score) });
        return;
      }
      const s: Mark = cfg.alternate ? (starter === 1 ? 2 : 1) : 1;
      setBoard(Array(n * n).fill(0));
      setResult(null);
      setRound(round + 1);
      setStarter(s);
      setTurn(s);
    }, NEXT_MS);
    return () => {
      clearTimeout(settle);
      clearTimeout(id);
    };
  }, [result, lock]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (cell: number) => {
    if (turn !== 1 || result || done || lock || board[cell] !== 0) return false;
    place(cell, 1);
    return true;
  };

  const resize = (next: number) => {
    if (next === n) return;
    setN(next);
    setBoard(Array(next * next).fill(0));
  };

  // Board fits under the scoreboard with room for the result line.
  const boardPx = Math.max(0, Math.min(size.w - space.lg * 2, size.h - 340, 400));
  const cellPx = (boardPx - GAP * (n - 1)) / n;
  const step = cellPx + GAP;
  const center = (i: number) => ({ x: (i % n) * step + cellPx / 2, y: Math.floor(i / n) * step + cellPx / 2 });

  const banner = !result
    ? turn === 1
      ? t('three.yourTurn')
      : null
    : result.winner === 1
      ? t('three.youWin')
      : little
        ? t('three.goodGame')
        : result.winner === 2
          ? t('three.theyWin')
          : t('three.draw');

  const [p, a] = wins;
  const matchTitle = little ? (p > a ? t('three.matchWon') : t('three.goodGame')) : p > a ? t('three.matchWon') : p < a ? t('three.matchLost') : t('three.matchDraw');

  return (
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <GameBar>
        <Readout label={t('three.readout.round')} value={`${round}/${ROUNDS}`} />
      </GameBar>

      {boardPx > 0 && (
        <View style={{ alignItems: 'center', gap: space.lg, marginTop: 56 }}>
          <View style={styles.scoreboard}>
            <Plate emoji={me} name={t('three.you')} wins={p} active={turn === 1 && !result} mine tint={lanes[lane].color} />
            {little ? (
              <View style={{ width: 24 }} />
            ) : (
              <Text style={styles.score} accessibilityLabel={`${t('three.you')} ${p}, ${t('three.them')} ${a}`}>
                {p}
                <Text style={{ color: color.text3 }}> : </Text>
                {a}
              </Text>
            )}
            <Plate emoji={pal} name={t('three.them')} wins={little ? -1 : a} active={turn === 2 && !result} thinking={turn === 2 && !result} tint={lanes[lane].color} />
          </View>

          <View key={`${round}-${n}`} style={{ width: boardPx, height: boardPx + LEDGE }}>
            {board.map((v, i) => (
              <Cell
                key={i}
                index={i}
                x={(i % n) * step}
                y={Math.floor(i / n) * step}
                px={cellPx}
                mark={v}
                emoji={v === 1 ? me : v === 2 ? pal : ''}
                tint={lanes[lane].color}
                winning={!!result?.line?.includes(i)}
                winner={result?.winner ?? 0}
                label={v === 0 ? t('three.cellEmpty', { n: i + 1 }) : v === 1 ? t('three.cellYou', { n: i + 1 }) : t('three.cellThem', { n: i + 1 })}
                onTap={() => tap(i)}
              />
            ))}
            {result?.line && (
              <WinLine
                from={center(result.line[0])}
                to={center(result.line[result.line.length - 1])}
                over={cellPx * 0.32}
                px={boardPx}
                width={Math.max(8, cellPx * 0.13)}
                tint={result.winner === 1 ? color.reward : alpha(color.text, little ? 0.55 : 0.7)}
              />
            )}
          </View>

          <View style={styles.bannerSlot}>
            {banner && (
              <Enter key={`${round}-${result ? result.winner : 'turn'}-${turn}`} rise={10} style={[styles.banner, result?.winner === 1 && styles.bannerWin]}>
                {result?.winner === 1 && <Text style={styles.bannerEmoji}>{me}</Text>}
                <Text style={[styles.bannerText, result?.winner === 1 && { color: color.ink }]}>{banner}</Text>
              </Enter>
            )}
          </View>

          {cfg.fourByFour && (
            <View style={[styles.sizes, { opacity: fresh ? 1 : 0 }]} pointerEvents={fresh ? 'auto' : 'none'} accessibilityLabel={t('three.boardSize')}>
              <Chip label="3×3" selected={n === 3} onPress={() => resize(3)} accessibilityRole="radio" />
              <Chip label="4×4" selected={n === 4} onPress={() => resize(4)} accessibilityRole="radio" />
            </View>
          )}
        </View>
      )}

      {done && (
        <>
          {!reduce && (p > a || little) && <Confetti x={size.w / 2} y={size.h * 0.4} count={44} spread={1.3} />}
          <Finish
            title={matchTitle}
            lines={little ? (p > 0 ? ['⭐'.repeat(p)] : [me]) : [`${p} – ${a}`, t('three.roundsWon', { count: p })]}
            record={done.record}
            onAgain={onAgain}
          />
        </>
      )}
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

/** A player's plate: their critter in a ledge-backed disc, name, and a pip per round won. */
function Plate({ emoji, name, wins, active, mine, thinking, tint }: { emoji: string; name: string; wins: number; active: boolean; mine?: boolean; thinking?: boolean; tint: string }) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const on = useSharedValue(active ? 1 : 0);
  const bob = useSharedValue(0);
  useEffect(() => {
    on.value = reduce ? (active ? 1 : 0) : withSpring(active ? 1 : 0, spring.bouncy);
  }, [active, reduce, on]);
  useEffect(() => {
    if (!active || reduce) {
      bob.value = withTiming(0, { duration: 120 });
      return;
    }
    bob.value = withRepeat(withSequence(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 420, easing: Easing.inOut(Easing.sin) })), -1, false);
  }, [active, reduce, bob]);
  const disc = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.45 * on.value,
    transform: [{ translateY: -4 * bob.value }, { scale: 0.9 + 0.12 * on.value }, { rotate: `${(mine ? -6 : 6) * bob.value}deg` }],
  }));
  return (
    <View style={styles.plate} accessibilityLabel={thinking ? t('three.thinking') : name}>
      <Animated.View style={disc}>
        <View style={[styles.discLedge, { backgroundColor: mine ? alpha(tint, 0.5) : color.line }]} />
        <View style={[styles.disc, mine ? { backgroundColor: tint, borderColor: alpha(tint, 0.5) } : null]}>
          <Text style={styles.discEmoji}>{emoji}</Text>
        </View>
      </Animated.View>
      <Text style={styles.plateName} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.pips}>
        {thinking ? <Thinking /> : wins >= 0 ? Array.from({ length: TO_WIN }, (_, i) => <Pip key={i} on={i < wins} />) : <View style={{ height: 10 }} />}
      </View>
    </View>
  );
}

function Pip({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    s.value = reduce ? (on ? 1 : 0) : on ? withSequence(withTiming(1.5, { duration: 140 }), withSpring(1, spring.bouncy)) : withTiming(0, { duration: 120 });
  }, [on, reduce, s]);
  const fill = useAnimatedStyle(() => ({ opacity: Math.min(1, s.value), transform: [{ scale: s.value }] }));
  return (
    <View style={styles.pip}>
      <Animated.View style={[styles.pipFill, fill]} />
    </View>
  );
}

/** Three dots taking turns to hop while buddy thinks. */
function Thinking() {
  return (
    <View style={{ flexDirection: 'row', gap: 4, height: 10, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 140} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!reduce) y.value = withDelay(delay, withRepeat(withSequence(withTiming(-4, { duration: 200 }), withTiming(0, { duration: 200 }), withTiming(0, { duration: 200 })), -1, false));
  }, [delay, reduce, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.dot, anim]} />;
}

type CellProps = {
  index: number;
  x: number;
  y: number;
  px: number;
  mark: Mark;
  emoji: string;
  tint: string;
  winning: boolean;
  winner: Mark;
  label: string;
  onTap: () => boolean;
};

/** A square on a hard ledge; a mark springs in when it's taken. */
function Cell({ index, x, y, px, mark, emoji, tint, winning, winner, label, onTap }: CellProps) {
  const reduce = useReducedMotion();
  const press = useSharedValue(0);
  const wiggle = useSharedValue(0);
  const enter = useSharedValue(reduce ? 1 : 0);
  const popIn = useSharedValue(mark ? 1 : 0);
  const cheer = useSharedValue(1);

  // A fresh board deals in square by square.
  useEffect(() => {
    if (!reduce) enter.value = withDelay(index * 28, withSpring(1, spring.smooth));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    popIn.value = reduce ? (mark ? 1 : 0) : mark ? withSpring(1, spring.bouncy) : 0;
  }, [mark, reduce, popIn]);

  // Winning marks jump in turn once the line is drawn.
  useEffect(() => {
    if (!winning || reduce) return;
    cheer.value = withDelay(380 + index * 30, withSequence(withTiming(1.22, { duration: 140 }), withSpring(1, spring.bouncy)));
  }, [winning]); // eslint-disable-line react-hooks/exhaustive-deps

  const shell = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.4),
    transform: [{ translateX: x + wiggle.value }, { translateY: y + (1 - enter.value) * 18 }, { scale: 0.8 + 0.2 * enter.value }],
  }));
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * LEDGE }] }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, popIn.value * 2),
    transform: [{ scale: popIn.value * cheer.value }, { rotate: `${(1 - popIn.value) * -25}deg` }],
  }));

  const mine = mark === 1;
  const won = winning && winner === 1;
  const r = Math.max(14, px * 0.2);
  return (
    <Animated.View style={[styles.cell, { width: px, height: px + LEDGE }, shell]}>
      <Pressable
        onPressIn={() => {
          if (!mark) press.value = withSpring(1, spring.snappy);
        }}
        onPressOut={() => (press.value = withSpring(0, spring.bouncy))}
        onPress={() => {
          if (onTap() || reduce) return;
          fx.tap();
          wiggle.value = withSequence(withTiming(-6, { duration: 50 }), withTiming(6, { duration: 70 }), withTiming(-3, { duration: 60 }), withSpring(0, spring.snappy));
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ width: px, height: px + LEDGE }}
      >
        <View style={[styles.cellLedge, { top: LEDGE, height: px, borderRadius: r, backgroundColor: won ? alpha(color.reward, 0.55) : mine ? alpha(tint, 0.4) : color.line }]} />
        <Animated.View
          style={[
            styles.cellFace,
            { width: px, height: px, borderRadius: r },
            mine && { backgroundColor: alpha(tint, 0.16), borderColor: alpha(tint, 0.55) },
            mark === 2 && { backgroundColor: color.surface2 },
            won && { borderColor: color.reward },
            face,
          ]}
        >
          {!!emoji && <Animated.Text style={[{ fontSize: px * 0.52 }, markStyle]}>{emoji}</Animated.Text>}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const ALine = Animated.createAnimatedComponent(Line);

/** The winning line drawing itself across the board, end to end. */
function WinLine({ from, to, over, px, width, tint }: { from: { x: number; y: number }; to: { x: number; y: number }; over: number; px: number; width: number; tint: string }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) p.value = withDelay(120, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Run a little past the end squares' centres so it reads as a stroke through them.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const a = { x: from.x - ux * over, y: from.y - uy * over };
  const b = { x: to.x + ux * over, y: to.y + uy * over };
  return <DrawnLine a={a} b={b} len={d + over * 2} px={px} width={width} tint={tint} p={p} />;
}

function DrawnLine({ a, b, len, px, width, tint, p }: { a: { x: number; y: number }; b: { x: number; y: number }; len: number; px: number; width: number; tint: string; p: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value) }));
  return (
    <Svg pointerEvents="none" width={px} height={px} style={StyleSheet.absoluteFill}>
      <ALine x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color.ink} strokeOpacity={0.5} strokeWidth={width + 6} strokeLinecap="round" strokeDasharray={[len, len]} animatedProps={props} />
      <ALine x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={tint} strokeWidth={width} strokeLinecap="round" strokeDasharray={[len, len]} animatedProps={props} />
    </Svg>
  );
}

// ── Play-tab card ────────────────────────────────────────────────────────────

const SCRIPT: [number, Mark][] = [
  [4, 1],
  [2, 2],
  [0, 1],
  [6, 2],
  [8, 1],
];
const SC = 30;
const SC_GAP = 5;

/** A tiny match on loop: marks pop in turn, then the diagonal draws itself. */
function ThreeScene({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? SCRIPT.length + 1 : 0);
  useEffect(() => {
    if (!active || reduce) return;
    const id = setInterval(() => setStep((s) => (s + 1) % (SCRIPT.length + 4)), 560);
    return () => clearInterval(id);
  }, [active, reduce]);

  const marks = new Map(SCRIPT.slice(0, Math.min(step, SCRIPT.length)));
  const side = SC * 3 + SC_GAP * 2;
  const c = (i: number) => ({ x: (i % 3) * (SC + SC_GAP) + SC / 2, y: Math.floor(i / 3) * (SC + SC_GAP) + SC / 2 });
  return (
    <View style={{ width: side, height: side }}>
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} style={[styles.sceneCell, { left: (i % 3) * (SC + SC_GAP), top: Math.floor(i / 3) * (SC + SC_GAP) }]}>
          {marks.has(i) && <SceneMark emoji={marks.get(i) === 1 ? '🐥' : '🦊'} />}
        </View>
      ))}
      {step > SCRIPT.length && <WinLine key="line" from={c(0)} to={c(8)} over={10} px={side} width={6} tint={color.white} />}
    </View>
  );
}

function SceneMark({ emoji }: { emoji: string }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) s.value = withSpring(1, spring.bouncy);
  }, [reduce, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { rotate: `${(1 - s.value) * -25}deg` }] }));
  return <Animated.Text style={[{ fontSize: size.lead }, anim]}>{emoji}</Animated.Text>;
}

export const threeInARowMeta: GameMeta = {
  id: 'three',
  name: 'three.name',
  sub: (lane, t) => (lane === 'little' ? t('three.subLittle') : lane === 'kids' ? t('three.sub') : lane === 'teen' ? t('three.subTeen') : t('three.subAdult')),
  tint: lanes.teen.color,
  Scene: ThreeScene,
  best: {
    // Most rounds won in one match (first to three ends it, so three is the top).
    format: (v, lane, t) => t(lane === 'adult' ? 'three.roundsHeld' : 'three.roundsWon', { count: v }),
    stars: (v, lane) => (lane === 'adult' ? (v >= 5 ? 3 : v >= 3 ? 2 : 1) : v >= 3 ? 3 : v === 2 ? 2 : 1),
    hiddenFor: ['little'],
  },
};

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill(), alignItems: 'center', justifyContent: 'center' },
  scoreboard: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  score: { color: color.text, fontFamily: font.mono, fontSize: size.heading, fontVariant: ['tabular-nums'], minWidth: 72, textAlign: 'center' },
  plate: { alignItems: 'center', gap: 6, width: 96 },
  disc: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.line, backgroundColor: color.surface1 },
  discLedge: { position: 'absolute', left: 0, top: 4, width: 60, height: 60, borderRadius: 30 },
  discEmoji: { fontSize: 32 },
  plateName: { color: color.text2, fontFamily: font.semibold, fontSize: size.small },
  pips: { flexDirection: 'row', gap: 5, height: 12, alignItems: 'center' },
  pip: { width: 12, height: 12, borderRadius: 6, backgroundColor: color.surface2, borderWidth: 1, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  pipFill: { width: 12, height: 12, borderRadius: 6, backgroundColor: color.reward },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.text2 },
  cell: { position: 'absolute', left: 0, top: 0 },
  cellLedge: { position: 'absolute', left: 0, right: 0 },
  cellFace: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.line, backgroundColor: color.surface1 },
  bannerSlot: { height: 48, justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line },
  bannerWin: { backgroundColor: color.reward, borderColor: color.reward },
  bannerEmoji: { fontSize: 20 },
  bannerText: { color: color.text, fontFamily: font.title, fontSize: size.lead, letterSpacing: -0.3 },
  sizes: { flexDirection: 'row', gap: space.sm },
  sceneCell: { position: 'absolute', width: SC, height: SC, borderRadius: 9, borderWidth: 2, borderColor: color.ink, backgroundColor: alpha(color.white, 0.5), alignItems: 'center', justifyContent: 'center' },
}));
