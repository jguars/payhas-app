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
import Svg, { Circle } from 'react-native-svg';

import { TimesUp } from '@/features/library/TimesUp';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { useInsets } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { alpha, color, font, Lane, lane as lanes, radius, space } from '@/theme/tokens';

import { Confetti } from './Confetti';
import { Finish, GameBar, Readout } from './GameChrome';
import { CRITTERS, shuffle, useBest, useGameSession } from './shared';
import type { GameMeta, GameProps } from './types';

/**
 * Per-lane tuning. Little counts critters with no clock and can't get one
 * wrong (a miss wiggles and waits); older lanes race a clock, a miss shows the
 * answer and moves on.
 */
export const COUNT: Record<Lane, { questions: number; timed: boolean; retry: boolean }> = {
  little: { questions: 10, timed: false, retry: true },
  kids: { questions: 10, timed: true, retry: false },
  teen: { questions: 10, timed: true, retry: false },
  adult: { questions: 10, timed: true, retry: false },
};

const LEDGE = 6;
const RIGHT_MS = 700;
const LITTLE_RIGHT_MS = 1400; // long enough for the critters to cheer
const WRONG_MS = 1500; // long enough to read the right answer

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <X,>(xs: X[]) => xs[Math.floor(Math.random() * xs.length)];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Best packs correct answers with time as the tiebreak: more right wins, then the faster round. */
const encode = (correct: number, seconds: number) => correct * 1000 + Math.max(0, 999 - seconds);
const decode = (n: number) => ({ correct: Math.floor(n / 1000), seconds: 999 - (n % 1000) });

// ── questions ────────────────────────────────────────────────────────────────

type Spot = { x: number; y: number; rot: number };
type Question = {
  answer: number;
  options: number[];
  symbol: string;
  /** Little: critters on the stage. */
  spots?: Spot[];
  /** Kids, small numbers: pictures. */
  pic?: { a: number; b: number; op: '+' | '−' };
  /** Everything else: the sum, in mono. */
  expr: string;
};

/** The answer plus two believable wrong ones (common slips first). */
function options(answer: number, near: number[]): number[] {
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n !== answer;
  const generic = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10];
  const pool = [...new Set([...shuffle(near.filter(ok)), ...shuffle(generic.filter(ok))])];
  const wrong = pool.slice(0, 2);
  for (let k = 3; wrong.length < 2; k++) if (!wrong.includes(answer + k)) wrong.push(answer + k);
  return shuffle([answer, ...wrong]);
}

function littleQuestion(prev: number, symbol: string): Question {
  let n = rnd(1, 5);
  while (n === prev) n = rnd(1, 5);
  // Six loose slots (3 × 2) with a little jitter, so the critters look scattered but never overlap.
  const slots = shuffle([0, 1, 2, 3, 4, 5]).slice(0, n);
  const spots = slots.map((s) => ({
    x: ((s % 3) + 0.5) / 3 + (Math.random() - 0.5) * 0.1,
    y: (Math.floor(s / 3) + 0.5) / 2 + (Math.random() - 0.5) * 0.14,
    rot: (Math.random() - 0.5) * 20,
  }));
  const others = shuffle([1, 2, 3, 4, 5].filter((v) => v !== n)).slice(0, 2);
  // Ascending, like a number line.
  return { answer: n, options: [n, ...others].sort((a, b) => a - b), symbol, spots, expr: '' };
}

function kidsQuestion(i: number, symbol: string): Question {
  const small = i < 3 || Math.random() < 0.25; // a gentle start with pictures
  if (Math.random() < 0.5) {
    const a = small ? rnd(1, 5) : rnd(3, 15);
    const b = small ? rnd(1, 5) : rnd(2, 20 - a);
    const answer = a + b;
    return { answer, options: options(answer, [a, b, Math.abs(a - b)]), symbol, pic: a <= 5 && b <= 5 ? { a, b, op: '+' } : undefined, expr: `${a} + ${b}` };
  }
  const a = small ? rnd(3, 9) : rnd(9, 20);
  const b = small ? rnd(1, a - 1) : rnd(2, a - 2);
  const answer = a - b;
  return { answer, options: options(answer, [a + b, b, a]), symbol, pic: a <= 9 ? { a, b, op: '−' } : undefined, expr: `${a} − ${b}` };
}

function teenQuestion(i: number, symbol: string): Question {
  if (i % 2 === 0) {
    const top = i < 4 ? 9 : 12;
    const a = rnd(2, top);
    const b = rnd(3, top);
    const answer = a * b;
    return { answer, options: options(answer, [a * (b + 1), a * (b - 1), (a + 1) * b, answer + 10]), symbol, expr: `${a} × ${b}` };
  }
  if (Math.random() < 0.5) {
    const a = rnd(12, 89);
    const b = rnd(11, 89);
    const answer = a + b;
    return { answer, options: options(answer, [answer - 10, answer + 10, answer + 1]), symbol, expr: `${a} + ${b}` };
  }
  const a = rnd(40, 99);
  const b = rnd(11, a - 11);
  const answer = a - b;
  return { answer, options: options(answer, [answer + 10, answer - 10, answer + 2]), symbol, expr: `${a} − ${b}` };
}

type AdultKind = 'mul' | 'div' | 'pct' | 'two';

function adultQuestion(kind: AdultKind, symbol: string): Question {
  if (kind === 'mul') {
    const a = rnd(6, 19);
    const b = rnd(3, 9);
    const answer = a * b;
    return { answer, options: options(answer, [a * (b + 1), a * (b - 1), answer + 10]), symbol, expr: `${a} × ${b}` };
  }
  if (kind === 'div') {
    const b = rnd(3, 12);
    const q = rnd(4, 15);
    return { answer: q, options: options(q, [q + 1, q - 1, q + 2]), symbol, expr: `${b * q} ÷ ${b}` };
  }
  if (kind === 'pct') {
    const p = pick([5, 10, 15, 20, 25, 30, 40, 50, 75]);
    const step = 100 / gcd(p, 100); // smallest n that gives a whole answer
    const n = step * rnd(Math.ceil(20 / step), Math.floor(400 / step));
    const answer = (p * n) / 100;
    return { answer, options: options(answer, [(p * n) / 10, answer + 5, answer - 5, n - answer]), symbol, expr: `${p}% × ${n}` };
  }
  const variant = rnd(0, 2);
  if (variant === 0) {
    const a = rnd(3, 12);
    const b = rnd(3, 9);
    const c = rnd(5, 40);
    const answer = a * b + c;
    return { answer, options: options(answer, [a * (b + c), answer - 10, a * b]), symbol, expr: `${a} × ${b} + ${c}` };
  }
  if (variant === 1) {
    const a = rnd(4, 12);
    const b = rnd(4, 9);
    const c = rnd(3, a * b - 4);
    const answer = a * b - c;
    return { answer, options: options(answer, [answer + 10, answer - 10, answer + 2]), symbol, expr: `${a} × ${b} − ${c}` };
  }
  const a = rnd(3, 15);
  const b = rnd(2, 12);
  const c = rnd(2, 6);
  const answer = (a + b) * c;
  // The classic slip: forgetting the brackets.
  return { answer, options: options(answer, [a + b * c, answer + c, answer - c]), symbol, expr: `(${a} + ${b}) × ${c}` };
}

function makeRound(lane: Lane, total: number): Question[] {
  const symbols = shuffle(CRITTERS);
  const kinds = shuffle<AdultKind>(['mul', 'mul', 'div', 'div', 'pct', 'pct', 'two', 'two', 'two', 'pct']);
  const out: Question[] = [];
  for (let i = 0; i < total; i++) {
    const symbol = symbols[i % symbols.length];
    if (lane === 'little') out.push(littleQuestion(out[i - 1]?.answer ?? 0, symbol));
    else if (lane === 'kids') out.push(kidsQuestion(i, symbol));
    else if (lane === 'teen') out.push(teenQuestion(i, symbol));
    else out.push(adultQuestion(kinds[i % kinds.length], symbol));
  }
  return out;
}

// ── the game ─────────────────────────────────────────────────────────────────

type Status = 'ask' | 'right' | 'wrong';
type TileState = 'idle' | 'right' | 'wrong' | 'reveal' | 'tried' | 'off';

/** One round of Quick Count. Remount (new key) to restart. */
export function QuickCount({ lane, onAgain }: GameProps) {
  const cfg = COUNT[lane];
  const little = lane === 'little';
  const { lock } = useGameSession('count');
  const best = useBest('count', lane);
  const { t } = useT();
  const insets = useInsets();
  const reduce = useReducedMotion();

  const [questions] = useState(() => makeRound(lane, cfg.questions));
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [qi, setQi] = useState(0);
  const [status, setStatus] = useState<Status>('ask');
  const [picked, setPicked] = useState<number | null>(null);
  const [tried, setTried] = useState<number[]>([]);
  const [results, setResults] = useState<('right' | 'wrong')[]>([]);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState<{ record: boolean; correct: number; bestStreak: number } | null>(null);
  const correct = useRef(0);
  const bestStreak = useRef(0);
  const secondsRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stagePop = useSharedValue(1);
  const stageShake = useSharedValue(0);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!cfg.timed || done || lock) return;
    const id = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [cfg.timed, done, lock]);

  const q = questions[qi];

  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  const next = () => {
    if (qi + 1 >= questions.length) {
      fx.win();
      const record = !little && best.submit(encode(correct.current, secondsRef.current));
      setDone({ record, correct: correct.current, bestStreak: bestStreak.current });
      return;
    }
    setQi(qi + 1);
    setStatus('ask');
    setPicked(null);
    setTried([]);
  };

  const answer = (v: number) => {
    if (status !== 'ask' || done || lock || tried.includes(v)) return;
    if (v === q.answer) {
      const s = streak + 1;
      correct.current += 1;
      setScore(correct.current);
      bestStreak.current = Math.max(bestStreak.current, s);
      if (little) fx.match();
      else if (s === 3 || s === 5 || s === 10) fx.combo();
      else fx.pop();
      setStreak(s);
      setPicked(v);
      setStatus('right');
      setResults((r) => [...r, 'right']);
      if (!reduce) stagePop.value = withSequence(withTiming(1.05, { duration: 110 }), withSpring(1, spring.bouncy));
      later(next, little ? LITTLE_RIGHT_MS : RIGHT_MS);
      return;
    }
    if (cfg.retry) {
      // Little: no penalty, that tile just wiggles and steps aside.
      fx.flip();
      setTried((tr) => [...tr, v]);
      return;
    }
    fx.wrong();
    if (!reduce) stageShake.value = withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 70 }), withTiming(-4, { duration: 60 }), withSpring(0, spring.snappy));
    setStreak(0);
    setPicked(v);
    setStatus('wrong');
    setResults((r) => [...r, 'wrong']);
    later(next, WRONG_MS);
  };

  const tileState = (v: number): TileState => {
    if (status === 'right') return v === picked ? 'right' : 'off';
    if (status === 'wrong') return v === picked ? 'wrong' : v === q.answer ? 'reveal' : 'off';
    return tried.includes(v) ? 'tried' : 'idle';
  };

  const stageAnim = useAnimatedStyle(() => ({ transform: [{ translateX: stageShake.value }, { scale: stagePop.value }] }));
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const tileW = Math.max(0, (size.w - space.lg * 2 - space.md * 2) / 3);
  const revealed = status !== 'ask';

  const title = little ? t('count.littleDone') : done?.correct === cfg.questions ? t('count.perfect') : (done?.correct ?? 0) >= 7 ? t('count.great') : t('count.goodTry');
  const prev = best.read();

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GameBar>
        {cfg.timed && <Readout label={t('play.readout.time')} value={fmt(seconds)} />}
        {!little && <Readout label={t('play.readout.score')} value={String(score)} />}
      </GameBar>

      <View style={[styles.body, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.meta}>
          <Progress total={cfg.questions} results={results} current={done ? -1 : qi} little={little} />
          {!little && <Flame streak={streak} />}
        </View>

        <Animated.View style={[styles.stage, stageAnim]}>
          {q.spots ? (
            <LittleStage key={qi} q={q} cheer={status === 'right'} />
          ) : (
            <View key={qi} style={styles.center}>
              {q.pic && <Pictures pic={q.pic} symbol={q.symbol} />}
              <Equation expr={q.expr} answer={q.answer} revealed={revealed} right={status === 'right'} small={!!q.pic} />
            </View>
          )}
        </Animated.View>

        {tileW > 0 && (
          <View style={styles.tiles}>
            {q.options.map((v, i) => (
              <Tile key={`${qi}-${v}`} value={v} index={i} w={tileW} dots={little} state={tileState(v)} onPress={() => answer(v)} />
            ))}
          </View>
        )}
      </View>

      {done && (
        <>
          {(little || done.correct >= cfg.questions / 2) && <Confetti x={size.w / 2} y={size.h * 0.38} count={44} spread={1.3} />}
          <Finish
            title={title}
            lines={
              little
                ? ['⭐'.repeat(cfg.questions)]
                : [
                    t('count.right', { n: done.correct, total: cfg.questions }),
                    t('count.timeLine', { time: fmt(seconds) }),
                    ...(done.bestStreak >= 3 ? [t('count.bestStreak', { n: done.bestStreak })] : []),
                    ...(prev != null && !done.record ? [t('play.best', { n: `${decode(prev).correct}/${cfg.questions} · ${fmt(decode(prev).seconds)}` })] : []),
                  ]
            }
            record={done.record}
            onAgain={onAgain}
          />
        </>
      )}
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

// ── pieces ───────────────────────────────────────────────────────────────────

/** Ten little beads: done ones fill in (stars for Little), the current one breathes. */
function Progress({ total, results, current, little }: { total: number; results: ('right' | 'wrong')[]; current: number; little: boolean }) {
  return (
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: results.length }}>
      {Array.from({ length: total }, (_, i) => (
        <Bead key={i} state={results[i] ?? (i === current ? 'now' : 'todo')} little={little} />
      ))}
    </View>
  );
}

function Bead({ state, little }: { state: 'right' | 'wrong' | 'now' | 'todo'; little: boolean }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    if (state === 'right' || state === 'wrong') s.value = withSequence(withTiming(1.6, { duration: 120 }), withSpring(1, spring.bouncy));
    else if (state === 'now') s.value = withRepeat(withSequence(withTiming(1.3, { duration: 520 }), withTiming(1, { duration: 520 })), -1, false);
    else s.value = 1;
  }, [state, reduce, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  if (little && state === 'right') {
    return (
      <Animated.View style={[styles.beadBox, anim]}>
        <Text style={styles.beadStar}>⭐</Text>
      </Animated.View>
    );
  }
  const bg = state === 'right' ? color.success : state === 'wrong' ? color.danger : state === 'now' ? color.text : color.line;
  return (
    <View style={styles.beadBox}>
      <Animated.View style={[styles.bead, { backgroundColor: bg }, anim]} />
    </View>
  );
}

/** The streak counter: shows up at two in a row, pops on every one after. */
function Flame({ streak }: { streak: number }) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const show = useSharedValue(0);
  const pop = useSharedValue(1);
  const on = streak >= 2;
  useEffect(() => {
    show.value = reduce ? (on ? 1 : 0) : withSpring(on ? 1 : 0, spring.snappy);
    if (on && !reduce) pop.value = withSequence(withTiming(1.35, { duration: 110 }), withSpring(1, spring.bouncy));
  }, [streak, on, reduce, show, pop]);
  const anim = useAnimatedStyle(() => ({ opacity: show.value, transform: [{ scale: (0.6 + 0.4 * show.value) * pop.value }, { rotate: `${(pop.value - 1) * 30}deg` }] }));
  return (
    <Animated.View style={[styles.flame, anim]} accessibilityLabel={on ? t('count.streak', { n: streak }) : undefined}>
      <Text style={styles.flameEmoji}>🔥</Text>
      <Text style={styles.flameText}>×{Math.max(2, streak)}</Text>
    </Animated.View>
  );
}

/** Little: critters scattered on the stage. Tap one and it hops and gets its number — counting out loud, with a finger. */
function LittleStage({ q, cheer }: { q: Question; cheer: boolean }) {
  const { t } = useT();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [counted, setCounted] = useState<number[]>([]);
  const spots = q.spots ?? [];
  const s = Math.min(box.w / 3.3, (box.h - 48) / 2.4, 92);

  const tap = (i: number) => {
    fx.pop();
    if (!counted.includes(i)) setCounted((c) => [...c, i]);
  };

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={styles.ask} pointerEvents="none">
        <Text style={styles.askMark}>?</Text>
        <Text style={styles.askText}>{t('count.howMany')}</Text>
      </View>
      {s > 0 &&
        spots.map((p, i) => (
          <CritterView
            key={i}
            index={i}
            symbol={q.symbol}
            size={s}
            x={p.x * box.w - s / 2}
            y={48 + p.y * (box.h - 60) - s / 2}
            rot={p.rot}
            cheer={cheer}
            badge={counted.includes(i) ? counted.indexOf(i) + 1 : 0}
            onTap={() => tap(i)}
          />
        ))}
    </View>
  );
}

function CritterView({ index, symbol, size, x, y, rot, cheer, badge, onTap }: { index: number; symbol: string; size: number; x: number; y: number; rot: number; cheer: boolean; badge: number; onTap: () => void }) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const enter = useSharedValue(reduce ? 1 : 0);
  const bob = useSharedValue(0);
  const hop = useSharedValue(0);
  const badgeIn = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    enter.value = withDelay(index * 90, withSpring(1, spring.bouncy));
    bob.value = withDelay(index * 170, withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const jump = (delay: number) => {
    if (reduce) return;
    hop.value = withDelay(delay, withSequence(withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(0, spring.bouncy)));
  };
  useEffect(() => {
    if (cheer) jump(index * 90);
  }, [cheer]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!badge) return;
    badgeIn.value = reduce ? 1 : withSpring(1, spring.bouncy);
  }, [badge, reduce, badgeIn]);

  const anim = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.5),
    transform: [{ translateY: -4 + 8 * bob.value - size * 0.32 * hop.value }, { rotate: `${rot}deg` }, { scale: enter.value * (1 + 0.12 * hop.value) }],
  }));
  const badgeAnim = useAnimatedStyle(() => ({ opacity: badgeIn.value, transform: [{ scale: badgeIn.value }] }));

  return (
    <Animated.View style={[styles.critter, { left: x, top: y, width: size, height: size }, anim]}>
      <Pressable
        onPress={() => {
          onTap();
          jump(0);
        }}
        style={styles.critterHit}
        accessibilityRole="button"
        accessibilityLabel={t('count.critter', { n: badge || index + 1 })}
      >
        <Text style={{ fontSize: size * 0.72 }}>{symbol}</Text>
      </Pressable>
      {badge > 0 && (
        <Animated.View pointerEvents="none" style={[styles.badge, badgeAnim]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** Kids, small numbers: the sum as pictures. Take-aways get crossed out. */
function Pictures({ pic, symbol }: { pic: { a: number; b: number; op: '+' | '−' }; symbol: string }) {
  if (pic.op === '−') {
    return (
      <View style={[styles.group, { maxWidth: 5 * 42 }]}>
        {Array.from({ length: pic.a }, (_, i) => (
          <Pic key={i} symbol={symbol} index={i} gone={i >= pic.a - pic.b} />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.picRow}>
      <View style={[styles.group, { maxWidth: 3 * 42 }]}>
        {Array.from({ length: pic.a }, (_, i) => (
          <Pic key={i} symbol={symbol} index={i} />
        ))}
      </View>
      <Text style={styles.picOp}>+</Text>
      <View style={[styles.group, { maxWidth: 3 * 42 }]}>
        {Array.from({ length: pic.b }, (_, i) => (
          <Pic key={i} symbol={symbol} index={pic.a + i} />
        ))}
      </View>
    </View>
  );
}

function Pic({ symbol, index, gone }: { symbol: string; index: number; gone?: boolean }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  const x = useSharedValue(reduce && gone ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    p.value = withDelay(index * 55, withSpring(1, spring.bouncy));
    // The take-away ones get crossed out a beat after they land.
    if (gone) x.value = withDelay(500 + index * 70, withSpring(1, spring.snappy));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => ({ opacity: p.value * (1 - 0.6 * x.value), transform: [{ scale: p.value }] }));
  const cross = useAnimatedStyle(() => ({ opacity: x.value, transform: [{ rotate: '-45deg' }, { scaleX: x.value }] }));
  return (
    <View style={styles.pic}>
      <Animated.Text style={[styles.picEmoji, anim]}>{symbol}</Animated.Text>
      {gone && <Animated.View pointerEvents="none" style={[styles.cross, cross]} />}
    </View>
  );
}

/** The sum in mono. The '?' turns into the answer once the question is over. */
function Equation({ expr, answer, revealed, right, small }: { expr: string; answer: number; revealed: boolean; right: boolean; small: boolean }) {
  const reduce = useReducedMotion();
  const enter = useSharedValue(reduce ? 1 : 0);
  const pop = useSharedValue(1);
  useEffect(() => {
    if (!reduce) enter.value = withSpring(1, spring.smooth);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (revealed && !reduce) pop.value = withSequence(withTiming(1.12, { duration: 110 }), withSpring(1, spring.bouncy));
  }, [revealed, reduce, pop]);
  const anim = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: (1 - enter.value) * 18 }, { scale: (0.9 + 0.1 * enter.value) * pop.value }] }));
  return (
    <Animated.View style={[styles.equationWrap, anim]}>
      <Text style={[styles.equation, small && styles.equationSmall]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} accessibilityLiveRegion="polite">
        {expr} ={' '}
        <Text style={{ color: revealed ? (right ? color.success : color.reward) : color.text3 }}>{revealed ? answer : '?'}</Text>
      </Text>
    </Animated.View>
  );
}

/** Dice dots for 1–5 on a 3 × 3 grid. */
const DOTS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8] };

/** A chunky answer tile on a hard ledge: presses down, pops when right, shakes when wrong. */
function Tile({ value, index, w, dots, state, onPress }: { value: number; index: number; w: number; dots: boolean; state: TileState; onPress: () => void }) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const enter = useSharedValue(reduce ? 1 : 0);
  const press = useSharedValue(0);
  const pop = useSharedValue(1);
  const shake = useSharedValue(0);
  const h = dots ? 132 : 96;

  useEffect(() => {
    if (!reduce) enter.value = withDelay(120 + index * 60, withSpring(1, spring.smooth));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reduce) return;
    if (state === 'right' || state === 'reveal') pop.value = withSequence(withTiming(state === 'right' ? 1.12 : 1.06, { duration: 110 }), withSpring(1, spring.bouncy));
    if (state === 'wrong' || state === 'tried')
      shake.value = withSequence(withTiming(-9, { duration: 50 }), withTiming(9, { duration: 70 }), withTiming(-6, { duration: 60 }), withTiming(4, { duration: 60 }), withSpring(0, spring.snappy));
  }, [state, reduce, pop, shake]);

  const shell = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.4),
    transform: [{ translateY: (1 - enter.value) * 40 }, { translateX: shake.value }, { scale: pop.value }],
  }));
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * LEDGE }] }));

  const fill = state === 'right' ? color.success : state === 'wrong' ? color.danger : color.surface1;
  const edge = state === 'right' ? shade(color.success) : state === 'wrong' ? shade(color.danger) : state === 'reveal' ? color.success : color.line;
  const ledge = state === 'right' || state === 'reveal' ? shade(color.success) : state === 'wrong' ? shade(color.danger) : color.line;
  const ink = state === 'right' || state === 'wrong' ? color.ink : state === 'reveal' ? color.success : color.text;
  const dim = state === 'tried' ? 0.3 : state === 'off' ? 0.45 : 1;
  const disabled = state !== 'idle';

  return (
    <Animated.View style={[{ width: w, opacity: dim }, shell]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          if (!disabled) press.value = withSpring(1, spring.snappy);
        }}
        onPressOut={() => (press.value = withSpring(0, spring.bouncy))}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('count.answer', { n: value })}
        accessibilityState={{ disabled }}
        style={{ paddingBottom: LEDGE }}
      >
        <View style={[styles.tileLedge, { backgroundColor: ledge }]} />
        <Animated.View style={[styles.tile, { height: h, backgroundColor: fill, borderColor: edge, borderWidth: state === 'reveal' ? 3 : 2 }, face]}>
          {dots && (
            <View style={styles.dots}>
              {Array.from({ length: 9 }, (_, i) => (
                <View key={i} style={styles.dotCell}>
                  {DOTS[value]?.includes(i) && <View style={[styles.dot, { backgroundColor: state === 'right' ? color.ink : lanes.little.color }]} />}
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.tileText, dots && styles.tileTextSmall, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {value}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** A darker edge of the same colour for a ledge (same rule as Chip). */
function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const k = 0.62;
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ── Play-tab card ────────────────────────────────────────────────────────────

const TINT = lanes.teen.color;
const SCENE_W = 170;
const SCENE_H = 110;

export const quickCountMeta: GameMeta = {
  id: 'count',
  name: 'count.name',
  sub: (lane, t) => {
    const n = COUNT[lane].questions;
    if (lane === 'little') return t('count.subLittle');
    if (lane === 'kids') return t('count.subKids', { count: n });
    if (lane === 'teen') return t('count.subTeen', { count: n });
    return t('count.subAdult', { count: n });
  },
  tint: TINT,
  Scene: CountScene,
  best: {
    format: (n, lane) => {
      const { correct, seconds } = decode(n);
      return `${correct}/${COUNT[lane].questions} · ${fmt(seconds)}`;
    },
    stars: (n, lane) => {
      const share = decode(n).correct / COUNT[lane].questions;
      return share >= 0.9 ? 3 : share >= 0.7 ? 2 : 1;
    },
    hiddenFor: ['little'],
  },
};

/** Three chicks hop over three answer tiles; the right one presses down and lights up, on a loop. */
function CountScene({ active }: { active: boolean }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const k = box.w ? Math.min(box.w / SCENE_W, box.h / SCENE_H) : 0;
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 340 170" preserveAspectRatio="xMidYMid slice">
        <Circle cx={30} cy={30} r={6} fill={color.ink} opacity={0.15} />
        <Circle cx={312} cy={40} r={9} fill={color.ink} opacity={0.15} />
        <Circle cx={300} cy={142} r={5} fill={color.ink} opacity={0.15} />
        <Circle cx={40} cy={140} r={7} fill={color.ink} opacity={0.15} />
      </Svg>
      {k > 0 && (
        <View style={{ width: SCENE_W, height: SCENE_H, transform: [{ scale: k }] }}>
          {[0, 1, 2].map((i) => (
            <MiniChick key={i} index={i} active={active} />
          ))}
          {[2, 3, 4].map((v, i) => (
            <MiniTile key={v} value={v} index={i} active={active} />
          ))}
        </View>
      )}
    </View>
  );
}

function MiniChick({ index, active }: { index: number; active: boolean }) {
  const reduce = useReducedMotion();
  const h = useSharedValue(0);
  useEffect(() => {
    if (reduce || !active) return;
    h.value = 0;
    // They hop one after another just before the tile is pressed: one, two, three.
    h.value = withDelay(
      index * 260,
      withRepeat(withSequence(withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 210, easing: Easing.in(Easing.quad) }), withDelay(2040, withTiming(0, { duration: 0 }))), -1, false),
    );
  }, [active, index, reduce, h]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: -12 * h.value }, { scale: 1 + 0.1 * h.value }] }));
  return <Animated.Text style={[styles.miniChick, { left: 30 + index * 40 }, anim]}>🐥</Animated.Text>;
}

function MiniTile({ value, index, active }: { value: number; index: number; active: boolean }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  const right = value === 3;
  useEffect(() => {
    if (reduce || !active || !right) return;
    p.value = 0;
    p.value = withRepeat(withSequence(withDelay(1000, withTiming(1, { duration: 140 })), withDelay(900, withTiming(0, { duration: 260 })), withDelay(160, withTiming(0, { duration: 0 }))), -1, false);
  }, [active, right, reduce, p]);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: p.value * 4 }, { scale: 1 + 0.06 * p.value }] }));
  const lit = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <View style={[styles.miniTileWrap, { left: 14 + index * 50 }]}>
      <View style={styles.miniLedge} />
      <Animated.View style={[styles.miniTile, face]}>
        <Text style={styles.miniNum}>{value}</Text>
        <Animated.View style={[StyleSheet.absoluteFill, styles.miniLit, lit]}>
          <Text style={[styles.miniNum, { color: TINT }]}>{value}</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  body: { flex: 1, paddingHorizontal: space.lg, gap: space.lg },
  meta: { alignItems: 'center', gap: space.sm, minHeight: 64 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.lg },
  stage: { flex: 1, borderRadius: radius.video, backgroundColor: color.surface1, borderWidth: 2, borderColor: color.line, overflow: 'hidden' },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  beadBox: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  bead: { width: 10, height: 10, borderRadius: 5 },
  beadStar: { fontSize: 15 },
  flame: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: alpha(color.ember, 0.16), borderWidth: 1, borderColor: alpha(color.ember, 0.4) },
  flameEmoji: { fontSize: 18 },
  flameText: { color: color.ember, fontFamily: font.mono, fontSize: 18, fontVariant: ['tabular-nums'] },
  ask: { position: 'absolute', left: space.lg, top: space.md, flexDirection: 'row', alignItems: 'center', gap: 6 },
  askMark: { color: lanes.little.color, fontFamily: font.display, fontSize: 26, letterSpacing: -0.6 },
  askText: { color: color.text2, fontFamily: font.title, fontSize: 17, letterSpacing: -0.3 },
  critter: { position: 'absolute' },
  critterHit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -4, top: -4, minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 6, backgroundColor: color.reward, borderWidth: 2, borderColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: color.ink, fontFamily: font.mono, fontSize: 16 },
  picRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  group: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  pic: { width: 42, height: 46, alignItems: 'center', justifyContent: 'center' },
  picEmoji: { fontSize: 32 },
  picOp: { color: color.text, fontFamily: font.mono, fontSize: 36 },
  cross: { position: 'absolute', width: 40, height: 4, borderRadius: 2, backgroundColor: color.danger },
  equationWrap: { alignSelf: 'stretch', alignItems: 'center' },
  equation: { color: color.text, fontFamily: font.mono, fontSize: 56, letterSpacing: -1, fontVariant: ['tabular-nums'], textAlign: 'center' },
  equationSmall: { fontSize: 34, color: color.text2 },
  tiles: { flexDirection: 'row', gap: space.md },
  tileLedge: { position: 'absolute', left: 0, right: 0, top: LEDGE, bottom: 0, borderRadius: 22 },
  tile: { borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: space.sm },
  tileText: { fontFamily: font.mono, fontSize: 40, fontVariant: ['tabular-nums'] },
  tileTextSmall: { fontSize: 28 },
  dots: { width: 54, height: 54, flexDirection: 'row', flexWrap: 'wrap' },
  dotCell: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 13, height: 13, borderRadius: 7 },
  miniChick: { position: 'absolute', top: 6, fontSize: 30 },
  miniTileWrap: { position: 'absolute', top: 56, width: 42, height: 46, paddingBottom: 4 },
  miniLedge: { position: 'absolute', left: 0, right: 0, top: 4, bottom: 0, borderRadius: 12, backgroundColor: color.ink },
  miniTile: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: color.ink, backgroundColor: color.text, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  miniLit: { backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  miniNum: { color: color.ink, fontFamily: font.mono, fontSize: 22 },
});
