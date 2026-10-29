import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityActionEvent, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedReaction,
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
import Svg, { Circle, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { TimesUp } from '@/features/library/TimesUp';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { useInsets } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { alpha, color, font, Lane, lane as lanes, pageFill, radius, space, themedStyles } from '@/theme/tokens';

import { Confetti } from './Confetti';
import { Finish, GameBar, Readout } from './GameChrome';
import { CRITTERS, useBest, useGameSession } from './shared';
import type { GameMeta, GameProps } from './types';

/**
 * Per-lane tuning.
 * - `fall`: ms for an item to cross the screen at the start; `every`: ms between drops.
 * - `ramp`: speed gained per second played, up to `cap` (×). Speed divides both fall and every.
 * - `cloud` / `golden`: chance a drop is a rain cloud / a golden star.
 * - `basket`: basket width as a share of the screen.
 * Little: slow, only good things, no lives — the round ends after `goal` catches.
 * Kids: a 45 s clock; a cloud just costs a few points. Teen/Adult: endless, three hearts.
 */
export const CATCH: Record<
  Lane,
  {
    fall: number;
    every: number;
    ramp: number;
    cap: number;
    round: number | null;
    goal: number | null;
    lives: number | null;
    cloud: number;
    cloudCost: number;
    golden: number;
    item: number;
    basket: number;
    combo: boolean;
  }
> = {
  little: {
    fall: 5200,
    every: 1500,
    ramp: 0,
    cap: 1,
    round: null,
    goal: 12,
    lives: null,
    cloud: 0,
    cloudCost: 0,
    golden: 0,
    item: 76,
    basket: 0.44,
    combo: false,
  },
  kids: {
    fall: 3900,
    every: 1000,
    ramp: 0.012,
    cap: 1.55,
    round: 45,
    goal: null,
    lives: null,
    cloud: 0.12,
    cloudCost: 3,
    golden: 0,
    item: 62,
    basket: 0.34,
    combo: false,
  },
  teen: {
    fall: 3100,
    every: 780,
    ramp: 0.014,
    cap: 2.4,
    round: null,
    goal: null,
    lives: 3,
    cloud: 0.2,
    cloudCost: 0,
    golden: 0.06,
    item: 56,
    basket: 0.29,
    combo: true,
  },
  adult: {
    fall: 2700,
    every: 680,
    ramp: 0.017,
    cap: 2.8,
    round: null,
    goal: null,
    lives: 3,
    cloud: 0.25,
    cloudCost: 0,
    golden: 0.06,
    item: 54,
    basket: 0.27,
    combo: true,
  },
};

const GOODS: { symbol: string; points: number }[] = [
  { symbol: '⭐', points: 1 },
  { symbol: '⭐', points: 1 },
  { symbol: '🍎', points: 1 },
  { symbol: '🍓', points: 1 },
  { symbol: '🍊', points: 1 },
  { symbol: '🍇', points: 1 },
  { symbol: '🍒', points: 1 },
  { symbol: '🎁', points: 2 },
];
const GOLDEN = { symbol: '🌟', points: 5 };
const CLOUD = '🌧️';

/** Catch streak → multiplier, for the combo lanes. */
const comboMult = (streak: number) => (streak >= 16 ? 3 : streak >= 8 ? 2 : 1);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

type Kind = 'good' | 'golden' | 'cloud';
type Item = {
  id: number;
  x: number;
  size: number;
  symbol: string;
  kind: Kind;
  points: number;
  fall: number;
  spin: number;
};
type Pop = {
  id: number;
  x: number;
  y: number;
  label: string;
  tone: 'good' | 'gold' | 'bad';
};

/** One round of Star Catcher. Remount (new key) to restart. */
export function StarCatcher({ lane, onAgain }: GameProps) {
  const cfg = CATCH[lane];
  const { lock } = useGameSession('catch');
  const best = useBest('catch', lane);
  const insets = useInsets();
  const { t } = useT();

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [items, setItems] = useState<Item[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [score, setScore] = useState(0);
  const [caught, setCaught] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(cfg.lives ?? 0);
  const [seconds, setSeconds] = useState(0);
  const [hint, setHint] = useState(true);
  const [done, setDone] = useState<{ record: boolean; out: boolean } | null>(null);
  const [critter] = useState(() => CRITTERS[Math.floor(Math.random() * 6)]); // the land animals

  const itemsRef = useRef<Item[]>([]);
  const nextId = useRef(1);
  const elapsed = useRef(0);
  const scoreRef = useRef(0);
  const caughtRef = useRef(0);
  const streakRef = useRef(0);
  const livesRef = useRef(cfg.lives ?? 0);
  const ended = useRef(false);

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

  // Basket: centre x on the UI thread, plus its lean, squash and hurt shake.
  const bx = useSharedValue(0);
  const tilt = useSharedValue(0);
  const squash = useSharedValue(0);
  const hop = useSharedValue(0);
  const hurt = useSharedValue(0);

  const running = size.w > 0 && !done && !lock;
  const BW = Math.min(240, Math.max(110, size.w * cfg.basket));
  const BH = BW * 0.42;
  const groundY = size.h - insets.bottom - 34; // basket bottom
  const rimY = groundY - BH; // where drops are judged
  const half = BW / 2;

  const sizeRef = useRef({ w: 0, h: 0, half: 0 });
  useLayoutEffect(() => {
    sizeRef.current = { w: size.w, h: size.h, half };
  });

  const write = (next: Item[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  useLayoutEffect(() => {
    if (size.w > 0) bx.set(size.w / 2);
  }, [size.w]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drops: the gap and the fall both shrink as speed ramps up.
  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setTimeout>;
    const speed = () => Math.min(cfg.cap, 1 + cfg.ramp * elapsed.current);
    const tick = () => {
      const { w } = sizeRef.current;
      const sp = speed();
      const r = Math.random();
      const kind: Kind = r < cfg.cloud ? 'cloud' : r < cfg.cloud + cfg.golden ? 'golden' : 'good';
      const good = kind === 'golden' ? GOLDEN : GOODS[Math.floor(Math.random() * GOODS.length)];
      const s = kind === 'cloud' ? cfg.item * 1.15 : cfg.item * (0.9 + Math.random() * 0.2);
      // Keep drops apart from the last one so two never stack.
      const prev = itemsRef.current[itemsRef.current.length - 1];
      let x = s / 2 + 10 + Math.random() * Math.max(1, w - s - 20);
      if (prev && Math.abs(prev.x - x) < s) x = ((x + w / 2) % (w - s / 2 - 10)) + s / 2;
      write([
        ...itemsRef.current,
        {
          id: nextId.current++,
          x: Math.min(w - s / 2 - 10, Math.max(s / 2 + 10, x)),
          size: s,
          symbol: kind === 'cloud' ? CLOUD : good.symbol,
          kind,
          points: kind === 'cloud' ? 0 : good.points,
          fall: (cfg.fall / sp) * (kind === 'cloud' ? 1.15 : 0.9 + Math.random() * 0.2),
          spin: kind === 'cloud' ? 0 : (Math.random() - 0.5) * 120,
        },
      ]);
      timer = setTimeout(tick, (cfg.every / sp) * (0.75 + Math.random() * 0.5));
    };
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clock: time left for Kids, time survived for the endless lanes; it also drives the ramp.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      elapsed.current += 1;
      setSeconds(elapsed.current);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const id = setTimeout(() => setHint(false), 3200);
    return () => clearTimeout(id);
  }, []);

  const finish = useCallback((out: boolean) => {
    if (ended.current) return;
    ended.current = true;
    write([]);
    if (out) fx.timesUp();
    else fx.win();
    setDone({
      record: cfg.goal == null ? best.submit(scoreRef.current) : false,
      out,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cfg.round != null && seconds >= cfg.round) finish(false);
  }, [seconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const addPop = (p: Omit<Pop, 'id'>) => {
    const id = nextId.current++;
    setPops((cur) => [...cur, { ...p, id }]);
    later(() => setPops((cur) => cur.filter((q) => q.id !== id)), 800);
  };

  /** A drop reached the rim inside the basket. */
  const onCatch = (id: number) => {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it || ended.current) return;
    const at = { x: it.x, y: rimY - 10 };
    if (it.kind === 'cloud') {
      streakRef.current = 0;
      setStreak(0);
      hurt.value = withSequence(
        withTiming(-10, { duration: 45 }),
        withTiming(10, { duration: 70 }),
        withTiming(-6, { duration: 60 }),
        withTiming(4, { duration: 55 }),
        withSpring(0, spring.snappy),
      );
      squash.value = withSequence(withTiming(-0.6, { duration: 80 }), withSpring(0, spring.bouncy));
      if (cfg.lives != null) {
        fx.wrong();
        livesRef.current -= 1;
        setLives(livesRef.current);
        addPop({ ...at, label: '💔', tone: 'bad' });
        if (livesRef.current <= 0) later(() => finish(true), 450);
      } else {
        fx.wrong();
        scoreRef.current = Math.max(0, scoreRef.current - cfg.cloudCost);
        setScore(scoreRef.current);
        addPop({ ...at, label: `−${cfg.cloudCost}`, tone: 'bad' });
      }
      return;
    }
    if (cfg.goal != null && caughtRef.current >= cfg.goal) return; // basket's already full
    const s = streakRef.current + 1;
    streakRef.current = s;
    setStreak(s);
    const mult = cfg.combo ? comboMult(s) : 1;
    const pts = it.points * mult;
    if (it.kind === 'golden') fx.match();
    else if (cfg.combo && (s === 8 || s === 16)) fx.combo();
    else fx.pop();
    scoreRef.current += pts;
    setScore(scoreRef.current);
    caughtRef.current += 1;
    setCaught(caughtRef.current);
    squash.value = withSequence(withTiming(1, { duration: 70 }), withSpring(0, spring.bouncy));
    hop.value = withSequence(withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }), withSpring(0, spring.bouncy));
    addPop({
      ...at,
      label: cfg.goal != null ? '' : `+${pts}`,
      tone: it.kind === 'golden' ? 'gold' : 'good',
    });
    if (cfg.goal != null && caughtRef.current === cfg.goal) later(() => finish(false), 500);
  };

  /** A good drop slipped past the basket: the streak breaks, nothing else. */
  const onMiss = (id: number) => {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it || it.kind === 'cloud' || !cfg.combo) return;
    streakRef.current = 0;
    setStreak(0);
  };

  // Worklets hold on to the callbacks they were made with; route through refs so they stay current.
  const handlers = useRef({ onCatch, onMiss });
  useLayoutEffect(() => {
    handlers.current = { onCatch, onMiss };
  });
  const catchCb = useCallback((id: number) => handlers.current.onCatch(id), []);
  const missCb = useCallback((id: number) => handlers.current.onMiss(id), []);
  const goneCb = useCallback((id: number) => write(itemsRef.current.filter((i) => i.id !== id)), []);

  // ── input: drag anywhere to slide the basket; a tap nudges it toward that side ──
  const moveTo = (x: number, animate: boolean) => {
    const { w, half: hw } = sizeRef.current;
    const clamped = Math.min(w - hw, Math.max(hw, x));
    bx.set(animate ? withSpring(clamped, spring.snappy) : clamped);
  };
  const nudge = (dir: -1 | 1) => {
    moveTo(bx.get() + dir * sizeRef.current.w * 0.2, true);
    tilt.value = withSequence(withTiming(dir * 10, { duration: 90 }), withSpring(0, spring.bouncy));
  };
  const drag = useRef({ start: 0, moved: false });
  // The responder's handlers read refs when touched, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        cancelAnimation(bx);
        drag.current = { start: bx.get(), moved: false };
      },
      onPanResponderMove: (_, g) => {
        if (!drag.current.moved && Math.abs(g.dx) < 6) return;
        if (!drag.current.moved) setHint(false);
        drag.current.moved = true;
        moveTo(drag.current.start + g.dx, false);
        tilt.value = withSpring(Math.max(-14, Math.min(14, g.vx * 9)), spring.snappy);
      },
      onPanResponderRelease: (e) => {
        tilt.value = withSpring(0, spring.bouncy);
        if (!drag.current.moved) nudge(e.nativeEvent.pageX < sizeRef.current.w / 2 ? -1 : 1);
      },
      onPanResponderTerminate: () => {
        tilt.value = withSpring(0, spring.bouncy);
      },
    }),
  );
  const onA11yAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') nudge(1);
    if (e.nativeEvent.actionName === 'decrement') nudge(-1);
  };

  const basketAnim = useAnimatedStyle(() => ({
    transform: [
      { translateX: bx.value - half + hurt.value },
      { translateY: BH * 0.08 * Math.max(0, squash.value) },
      { rotate: `${tilt.value}deg` },
      { scaleX: 1 + 0.1 * squash.value },
      { scaleY: 1 - 0.14 * squash.value },
    ],
  }));
  const critterAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: -BH * 0.32 * hop.value }, { rotate: `${hurt.value * 1.2}deg` }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const mult = cfg.combo ? comboMult(streak) : 1;
  const C = BW * 0.4; // critter size

  return (
    <View style={styles.root} onLayout={onLayout}>
      <NightSky w={size.w} h={size.h} groundY={groundY} />

      {/* The play area takes the drag; the bar and the end card sit above it. */}
      <View
        style={StyleSheet.absoluteFill}
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('catch.basket')}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onA11yAction}
      >
        {size.h > 0 &&
          !lock &&
          items.map((it) => <Drop key={it.id} it={it} h={size.h} rimY={rimY} bx={bx} half={half} onCatch={catchCb} onMiss={missCb} onGone={goneCb} />)}

        {size.w > 0 && (
          <Animated.View pointerEvents="none" style={[styles.basketWrap, { top: rimY - C * 0.7, width: BW, height: BH + C * 0.7 }, basketAnim]}>
            <Animated.View style={[styles.critter, { width: C, height: C, left: (BW - C) / 2 }, critterAnim]}>
              <Text style={{ fontSize: C * 0.86, lineHeight: C }}>{critter}</Text>
            </Animated.View>
            <View
              style={[
                styles.basket,
                {
                  top: C * 0.7 + BH * 0.16,
                  height: BH * 0.84,
                  borderBottomLeftRadius: BH * 0.5,
                  borderBottomRightRadius: BH * 0.5,
                },
              ]}
            >
              <View style={[styles.weave, { top: BH * 0.18 }]} />
              <View style={[styles.weave, { top: BH * 0.42 }]} />
              <View style={[styles.weave, { top: BH * 0.66, left: '18%', right: '18%' }]} />
            </View>
            <View style={[styles.rim, { top: C * 0.7, height: BH * 0.26, borderRadius: BH * 0.13 }]} />
          </Animated.View>
        )}

        {pops.map((p) => (
          <Burst key={p.id} p={p} />
        ))}
      </View>

      <GameBar>
        {cfg.round != null && <Readout label={t('play.readout.time')} value={`${Math.max(0, cfg.round - seconds)}`} />}
        {cfg.lives != null && <Hearts lives={lives} of={cfg.lives} label={t('catch.lives', { count: lives })} />}
        {cfg.goal != null ? (
          <Readout label={t('catch.readout.caught')} value={`${caught}/${cfg.goal}`} />
        ) : (
          <Readout label={t('play.readout.score')} value={String(score)} />
        )}
      </GameBar>

      {!done && (
        <View pointerEvents="none" style={[styles.hintWrap, { top: insets.top + 64 }]}>
          {cfg.goal != null && <Progress n={caught} of={cfg.goal} />}
          <View style={styles.hintRow}>
            {cfg.cloud > 0 && (
              <Enter style={styles.hint}>
                <Text style={styles.hintText}>{t('catch.dodge')}</Text>
                <Text style={styles.hintEmoji}>{CLOUD}</Text>
              </Enter>
            )}
            {mult > 1 && (
              <Enter key={mult} rise={8} style={[styles.hint, styles.combo]}>
                <Text style={styles.comboText}>×{mult}</Text>
                <Text style={styles.hintText}>{streak}</Text>
              </Enter>
            )}
          </View>
        </View>
      )}

      {hint && !done && size.w > 0 && <DragHint y={rimY - BW * 0.55} label={t('catch.drag')} />}

      {done && (
        <>
          {!done.out && <Confetti x={size.w / 2} y={size.h * 0.35} count={40} spread={1.2} />}
          <Finish
            title={cfg.goal != null ? t('catch.basketFull') : done.out ? t('catch.outOfHearts') : score > 0 ? t('catch.greatCatching') : t('play.timeUp')}
            lines={
              cfg.goal != null
                ? [t('catch.caught', { count: caught })]
                : [
                    t('play.points', { count: score }),
                    ...(cfg.round == null ? [t('catch.lasted', { time: fmt(seconds) })] : []),
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
 * One falling thing. It falls on the UI thread; the frame it crosses the rim
 * it checks the basket's x once (two subtractions) and reports back.
 */
function Drop({
  it,
  h,
  rimY,
  bx,
  half,
  onCatch,
  onMiss,
  onGone,
}: {
  it: Item;
  h: number;
  rimY: number;
  bx: SharedValue<number>;
  half: number;
  onCatch: (id: number) => void;
  onMiss: (id: number) => void;
  onGone: (id: number) => void;
}) {
  const reduce = useReducedMotion();
  const end = h + it.size;
  const y = useSharedValue(-it.size);
  const judged = useSharedValue(0);
  const inBasket = useSharedValue(0);
  const caughtAt = useSharedValue(0);
  const twinkle = useSharedValue(0);

  useEffect(() => {
    y.value = withTiming(
      end,
      {
        duration: it.fall * ((end + it.size) / (rimY + it.size)),
        easing: Easing.linear,
      },
      (finished) => {
        if (finished) scheduleOnRN(onGone, it.id);
      },
    );
    if (it.kind === 'golden' && !reduce) twinkle.value = withRepeat(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Judge once, at the rim. A catch stops the fall and drops it into the basket.
  const reach = half + it.size * 0.3;
  useAnimatedReaction(
    () => y.value >= rimY,
    (crossed) => {
      if (!crossed || judged.value) return;
      judged.value = 1;
      if (Math.abs(it.x - bx.value) <= reach) {
        cancelAnimation(y);
        caughtAt.value = bx.value;
        scheduleOnRN(onCatch, it.id);
        inBasket.value = withTiming(1, { duration: 240, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) scheduleOnRN(onGone, it.id);
        });
      } else {
        scheduleOnRN(onMiss, it.id);
      }
    },
  );

  const anim = useAnimatedStyle(() => {
    const k = inBasket.value;
    const sway = it.kind === 'cloud' && !reduce ? Math.sin(y.value / 60) * 10 : 0;
    // Once caught, ride along with the basket while sinking in.
    const x = k > 0 ? it.x + (bx.value - caughtAt.value) * k : it.x;
    const bad = it.kind === 'cloud';
    return {
      opacity: k > 0 ? (bad ? 1 - k : 1 - k * 0.9) : 1,
      transform: [
        { translateX: x - it.size / 2 + sway },
        { translateY: y.value - it.size / 2 + k * (bad ? -6 : it.size * 0.45) },
        { rotate: `${reduce ? 0 : (y.value / Math.max(1, h)) * it.spin}deg` },
        {
          scale: (bad ? 1 + 0.5 * k : 1 - 0.55 * k) * (1 + 0.12 * twinkle.value),
        },
      ],
    };
  });
  const glow = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.35 * twinkle.value,
    transform: [{ scale: 1 + 0.25 * twinkle.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.drop, { width: it.size, height: it.size }, anim]}>
      {it.kind === 'golden' && <Animated.View style={[styles.glow, { borderRadius: it.size / 2 }, glow]} />}
      <Text style={{ fontSize: it.size * 0.78, lineHeight: it.size }}>{it.symbol}</Text>
    </Animated.View>
  );
}

/** Sparkles + a floating label where something landed. */
function Burst({ p }: { p: Pop }) {
  const reduce = useReducedMotion();
  const b = useSharedValue(0);
  useEffect(() => {
    b.value = withTiming(1, {
      duration: 720,
      easing: Easing.out(Easing.cubic),
    });
  }, [b]);
  const label = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, b.value - 0.5) * 2,
    transform: [{ translateY: -58 * b.value }, { scale: 0.7 + 0.5 * Math.min(1, b.value * 3) }],
  }));
  const n = p.tone === 'gold' ? 8 : p.tone === 'good' ? 5 : 0;
  return (
    <View pointerEvents="none" style={[styles.burstAnchor, { left: p.x, top: p.y }]}>
      {!reduce && Array.from({ length: n }, (_, i) => <Spark key={i} i={i} n={n} b={b} gold={p.tone === 'gold'} />)}
      {p.tone === 'bad' && !reduce && [0, 1, 2, 3].map((i) => <Raindrop key={i} i={i} b={b} />)}
      {p.label !== '' && (
        <Animated.Text style={[styles.label, p.tone === 'bad' && { color: color.danger }, p.tone === 'gold' && { color: color.reward, fontSize: 32 }, label]}>
          {p.label}
        </Animated.Text>
      )}
    </View>
  );
}

function Spark({ i, n, b, gold }: { i: number; n: number; b: SharedValue<number>; gold: boolean }) {
  const angle = -Math.PI / 2 + ((i - (n - 1) / 2) / n) * Math.PI * 1.5;
  const reach = gold ? 90 : 60;
  const anim = useAnimatedStyle(() => ({
    opacity: b.value < 1 ? 1 - b.value : 0,
    transform: [
      { translateX: Math.cos(angle) * reach * b.value },
      {
        translateY: Math.sin(angle) * reach * b.value + 30 * b.value * b.value,
      },
      { rotate: `${b.value * 180}deg` },
      { scale: 1.1 - 0.5 * b.value },
    ],
  }));
  return <Animated.Text style={[styles.spark, i % 2 === 1 && !gold ? { color: color.text } : null, anim]}>★</Animated.Text>;
}

function Raindrop({ i, b }: { i: number; b: SharedValue<number> }) {
  const dx = (i - 1.5) * 16;
  const anim = useAnimatedStyle(() => ({
    opacity: b.value < 1 ? 1 - b.value : 0,
    transform: [{ translateX: dx * (1 + b.value) }, { translateY: -10 + 50 * b.value * b.value }],
  }));
  return <Animated.View style={[styles.raindrop, anim]} />;
}

/** Lives as hearts; the one just lost pops and greys out. */
function Hearts({ lives, of, label }: { lives: number; of: number; label: string }) {
  return (
    <View style={styles.hearts} accessibilityLabel={label}>
      {Array.from({ length: of }, (_, i) => (
        <Heart key={i} on={i < lives} />
      ))}
    </View>
  );
}

function Heart({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(0);
  useEffect(() => {
    if (!on && !reduce) s.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0, spring.bouncy));
  }, [on, reduce, s]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.5 * s.value }, { rotate: `${s.value * -18}deg` }],
  }));
  return (
    <Animated.View style={anim}>
      <Icon name="heart" size={20} color={on ? color.danger : color.line} filled />
    </Animated.View>
  );
}

/** Little's progress: a row of dots that fill with starlight, one per catch. */
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

/** A finger swaying left and right over the basket for the first few seconds. */
function DragHint({ y, label }: { y: number; label: string }) {
  const reduce = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!reduce) v.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, v]);
  const hand = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(v.value, [0, 1], [-36, 36]) }],
  }));
  return (
    <Enter delay={300} style={[styles.dragHint, { top: y }]}>
      <Animated.Text style={[styles.hand, hand]}>👆</Animated.Text>
      <Text style={styles.hintText}>{label}</Text>
    </Enter>
  );
}

/** Stable pseudo-random in [0, 1) so the sky is the same on every render. */
const hash = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const SKY_STARS = Array.from({ length: 34 }, (_, i) => ({
  x: hash(i, 1),
  y: hash(i, 2) * 0.8,
  r: 0.8 + hash(i, 3) * 1.6,
  twinkle: i % 5 === 0,
  delay: hash(i, 4) * 2000,
}));

/** Night sky: a crescent moon, a scatter of stars (a few twinkle), and a hill for the basket. */
function NightSky({ w, h, groundY }: { w: number; h: number; groundY: number }) {
  if (!w) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        {SKY_STARS.filter((s) => !s.twinkle).map((s, i) => (
          <Circle key={i} cx={s.x * w} cy={s.y * h} r={s.r} fill={color.text} opacity={0.35} />
        ))}
        <Circle cx={w - 70} cy={h * 0.2} r={30} fill={alpha(color.reward, 0.9)} />
        <Circle cx={w - 56} cy={h * 0.2 - 10} r={27} fill={color.ink} />
        <Path
          d={`M0 ${groundY + 6} C ${w * 0.3} ${groundY - 14}, ${w * 0.7} ${groundY + 18}, ${w} ${groundY - 4} L ${w} ${h} L 0 ${h} Z`}
          fill={color.surface1}
        />
        <Path
          d={`M0 ${groundY + 6} C ${w * 0.3} ${groundY - 14}, ${w * 0.7} ${groundY + 18}, ${w} ${groundY - 4}`}
          fill="none"
          stroke={color.line}
          strokeWidth={2}
        />
      </Svg>
      {SKY_STARS.filter((s) => s.twinkle).map((s, i) => (
        <Twinkle key={i} x={s.x * w} y={s.y * h} delay={s.delay} />
      ))}
    </View>
  );
}

function Twinkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const reduce = useReducedMotion();
  const v = useSharedValue(0.5);
  useEffect(() => {
    if (!reduce) v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [delay, reduce, v]);
  const anim = useAnimatedStyle(() => ({
    opacity: 0.2 + 0.8 * v.value,
    transform: [{ scale: 0.6 + 0.6 * v.value }],
  }));
  return <Animated.Text style={[styles.twinkle, { left: x - 6, top: y - 8 }, anim]}>✦</Animated.Text>;
}

// ── Play-tab card ─────────────────────────────────────────────────────────────

/** A basket gliding side to side, catching a star and a strawberry in turn. */
function CatchScene({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const c = useSharedValue(0.25);
  useEffect(() => {
    if (reduce || !active) {
      cancelAnimation(c);
      if (reduce) c.value = 0.25;
      return;
    }
    c.value = 0;
    c.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1, false);
  }, [active, reduce, c]);

  const { w, h } = box;
  const BW = Math.min(w * 0.3, h * 0.62);
  const BH = BW * 0.42;
  const rim = h - BH - h * 0.08;
  const I = BW * 0.42;
  // Basket centre swings between 28% and 72%; each drop lands as it arrives.
  const basket = useAnimatedStyle(() => {
    const p = 0.5 - 0.22 * Math.cos(c.value * Math.PI * 2);
    return { transform: [{ translateX: p * w - BW / 2 }] };
  });
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
        <Circle cx={40} cy={34} r={3} fill={color.ink} opacity={0.25} />
        <Circle cx={120} cy={22} r={2} fill={color.ink} opacity={0.25} />
        <Circle cx={210} cy={40} r={2.5} fill={color.ink} opacity={0.25} />
        <Circle cx={300} cy={28} r={3} fill={color.ink} opacity={0.25} />
        <Path d="M0 158 C 100 146, 240 166, 340 150 L 340 170 L 0 170 Z" fill={color.ink} opacity={0.14} />
      </Svg>
      {w > 0 && (
        <>
          <SceneDrop c={c} x={0.72 * w} size={I} from={-I} to={rim} start={0} end={0.5} emoji="⭐" />
          <SceneDrop c={c} x={0.28 * w} size={I} from={-I} to={rim} start={0.5} end={1} emoji="🍓" />
          <Animated.View style={[styles.sceneBasket, { top: rim - BH * 0.1, width: BW, height: BH }, basket]}>
            <View
              style={[
                styles.sceneBody,
                {
                  borderBottomLeftRadius: BH * 0.5,
                  borderBottomRightRadius: BH * 0.5,
                },
              ]}
            />
            <View style={[styles.sceneRim, { height: BH * 0.3, borderRadius: BH * 0.15 }]} />
          </Animated.View>
        </>
      )}
    </View>
  );
}

function SceneDrop({
  c,
  x,
  size,
  from,
  to,
  start,
  end,
  emoji,
}: {
  c: SharedValue<number>;
  x: number;
  size: number;
  from: number;
  to: number;
  start: number;
  end: number;
  emoji: string;
}) {
  const anim = useAnimatedStyle(() => {
    const t = (c.value - start) / (end - start);
    const p = Math.min(1, Math.max(0, t));
    // Fall for the first 90%, then sink into the basket.
    const fall = Math.min(1, p / 0.9);
    const sink = Math.max(0, (p - 0.9) / 0.1);
    return {
      opacity: t <= 0 || t >= 1 ? 0 : 1 - sink,
      transform: [
        { translateX: x - size / 2 },
        {
          translateY: from + (to - from) * fall * fall + sink * size * 0.3 - size / 2,
        },
        { scale: 1 - 0.4 * sink },
        { rotate: `${p * 40}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.drop, { width: size, height: size }, anim]}>
      <Text style={{ fontSize: size * 0.8, lineHeight: size }}>{emoji}</Text>
    </Animated.View>
  );
}

export const starCatcherMeta: GameMeta = {
  id: 'catch',
  name: 'catch.name',
  sub: (lane, t) => {
    const cfg = CATCH[lane];
    if (cfg.goal != null) return t('catch.subLittle');
    return cfg.round != null ? t('catch.sub', { s: cfg.round }) : t('catch.subEndless');
  },
  tint: lanes.adult.color,
  Scene: CatchScene,
  best: {
    format: (n, _lane, t) => t('play.ptsShort', { count: n }),
    // Kids play a 45 s round; the endless lanes run until the hearts are gone.
    stars: (n, lane) => {
      const [three, two] = lane === 'kids' ? [36, 18] : [90, 40];
      return n >= three ? 3 : n >= two ? 2 : 1;
    },
    hiddenFor: ['little'],
  },
};

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill(), overflow: 'hidden' },
  drop: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(color.reward, 0.35),
  },
  basketWrap: { position: 'absolute', left: 0 },
  critter: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  basket: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    backgroundColor: color.reward,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: color.ink,
    overflow: 'hidden',
  },
  weave: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    height: 3,
    borderRadius: 2,
    backgroundColor: alpha(color.ink, 0.22),
  },
  rim: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: color.reward,
    borderWidth: 2,
    borderColor: color.ink,
  },
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
    fontSize: 22,
  },
  raindrop: {
    position: 'absolute',
    left: -3,
    top: -6,
    width: 6,
    height: 12,
    borderRadius: 3,
    backgroundColor: color.info,
  },
  label: {
    position: 'absolute',
    width: 90,
    left: -45,
    top: -18,
    textAlign: 'center',
    color: color.text,
    fontFamily: font.display,
    fontSize: 26,
    letterSpacing: -0.5,
  },
  hearts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: alpha(color.surface1, 0.7),
  },
  hintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: space.sm,
  },
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
  hintText: { color: color.text2, fontFamily: font.semibold, fontSize: 14 },
  hintEmoji: { fontSize: 20 },
  combo: { borderColor: alpha(color.reward, 0.5) },
  comboText: {
    color: color.reward,
    fontFamily: font.display,
    fontSize: 18,
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
  dragHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  hand: { fontSize: 34 },
  twinkle: {
    position: 'absolute',
    width: 12,
    textAlign: 'center',
    color: color.text,
    fontSize: 12,
  },
  sceneBasket: { position: 'absolute', left: 0 },
  sceneBody: {
    position: 'absolute',
    left: '7%',
    right: '7%',
    top: '20%',
    bottom: 0,
    backgroundColor: color.reward,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: color.ink,
  },
  sceneRim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: color.reward,
    borderWidth: 2,
    borderColor: color.ink,
  },
}));
