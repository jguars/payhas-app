import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Enter } from '@/components/motion/Enter';
import { TimesUp } from '@/features/library/TimesUp';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { color, font, Lane, radius, space } from '@/theme/tokens';

import { Confetti } from './Confetti';
import { Finish, GameBar, Readout } from './GameChrome';
import { BUBBLES, CRITTERS, shuffle, useBest, useGameSession } from './shared';

const TINTS = ['rgba(120,166,255,0.22)', 'rgba(79,227,176,0.2)', 'rgba(255,210,94,0.2)', 'rgba(195,162,255,0.22)', 'rgba(255,90,60,0.2)'];
const POOL_SIZE = 5; // critters in play at once for target rounds
const TARGET_EVERY = 5; // correct pops before the target changes

type Bubble = { id: number; x: number; size: number; symbol: string; tint: string; rise: number; phase: number; sway: number };

/** One round of Bubble Pop. Remount (new key) to restart. */
export function BubblePop({ lane, onAgain }: { lane: Lane; onAgain: () => void }) {
  const cfg = BUBBLES[lane];
  const { lock } = useGameSession('bubbles');
  const best = useBest('bubbles', lane);
  const { t } = useT();

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState(cfg.round ?? 0);
  const [done, setDone] = useState<{ record: boolean } | null>(null);
  const [pool] = useState(() => shuffle(CRITTERS).slice(0, POOL_SIZE));
  const [target, setTarget] = useState(pool[0]);
  const hits = useRef(0);
  const nextId = useRef(1);

  const running = size.w > 0 && !done && !lock;

  // Spawn: targets show up often enough to keep it fair (about 40%).
  useEffect(() => {
    if (!running) return;
    const spawn = () => {
      const s = 64 + Math.random() * 30;
      const symbol = cfg.targets && Math.random() < 0.4 ? target : pool[Math.floor(Math.random() * pool.length)];
      const b: Bubble = {
        id: nextId.current++,
        x: 8 + Math.random() * Math.max(1, size.w - s - 16),
        size: s,
        symbol,
        tint: TINTS[Math.floor(Math.random() * TINTS.length)],
        rise: cfg.rise * (0.85 + Math.random() * 0.3),
        phase: Math.random() * Math.PI * 2,
        sway: 10 + Math.random() * 14,
      };
      setBubbles((cur) => [...cur, b]);
    };
    spawn();
    const id = setInterval(spawn, cfg.every);
    return () => clearInterval(id);
  }, [running, size.w, target]); // eslint-disable-line react-hooks/exhaustive-deps

  // Round clock (not for Little).
  useEffect(() => {
    if (!running || cfg.round == null) return;
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [running, cfg.round]);

  useEffect(() => {
    if (cfg.round != null && left <= 0 && !done) {
      setBubbles([]);
      fx.win();
      setDone({ record: best.submit(score) });
    }
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = useCallback((id: number) => setBubbles((cur) => cur.filter((b) => b.id !== id)), []);

  /** Returns the label to float up from the bubble ('+2', '✗'), and whether it was right. */
  const pop = useCallback(
    (b: Bubble): { label: string; right: boolean } => {
      if (!cfg.targets) {
        fx.pop();
        setScore((s) => s + 1);
        return { label: '+1', right: true };
      }
      if (b.symbol !== target) {
        fx.wrong();
        setCombo(0);
        return { label: '✗', right: false };
      }
      const nextCombo = combo + 1;
      const mult = nextCombo >= 10 ? 3 : nextCombo >= 5 ? 2 : 1;
      // Stepping up to ×2 or ×3 gets its own chime; every other hit just pops.
      if (nextCombo === 5 || nextCombo === 10) fx.combo();
      else fx.pop();
      setCombo(nextCombo);
      setScore((s) => s + mult);
      hits.current += 1;
      if (hits.current % TARGET_EVERY === 0) {
        setTarget((t) => {
          const others = pool.filter((p) => p !== t);
          return others[Math.floor(Math.random() * others.length)];
        });
      }
      return { label: `+${mult}`, right: true };
    },
    [cfg.targets, target, combo, pool],
  );

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const mult = combo >= 10 ? 3 : combo >= 5 ? 2 : 1;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Ambient />
      {size.h > 0 && bubbles.map((b) => <BubbleView key={b.id} b={b} h={size.h} onPop={pop} onGone={remove} />)}

      <GameBar>
        {cfg.round != null && <Readout label={t('play.readout.time')} value={`${Math.max(0, left)}`} />}
        <Readout label={cfg.targets ? t('play.readout.score') : t('play.readout.pops')} value={String(score)} />
      </GameBar>

      {cfg.targets && !done && (
        <View pointerEvents="none" style={styles.targetWrap}>
          <Enter key={target} rise={8} style={styles.target}>
            <Text style={styles.targetText}>{t('play.popThe')}</Text>
            <Text style={styles.targetEmoji}>{target}</Text>
            {mult > 1 && <Text style={styles.mult}>×{mult}</Text>}
          </Enter>
        </View>
      )}

      {done && (
        <>
          <Confetti x={size.w / 2} y={size.h * 0.35} count={36} />
          <Finish
            title={score > 0 ? t('play.nicePopping') : t('play.timeUp')}
            lines={[t('play.points', { count: score }), ...(best.read() != null && !done.record ? [t('play.best', { n: best.read() ?? 0 })] : [])]}
            record={done.record && score > 0}
            onAgain={onAgain}
          />
        </>
      )}
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

function BubbleView({
  b,
  h,
  onPop,
  onGone,
}: {
  b: Bubble;
  h: number;
  onPop: (b: Bubble) => { label: string; right: boolean };
  onGone: (id: number) => void;
}) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  const burst = useSharedValue(0);
  const shake = useSharedValue(0);
  const [result, setResult] = useState<{ label: string; right: boolean } | null>(null);

  useEffect(() => {
    y.value = withTiming(1, { duration: b.rise, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onGone, b.id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const travel = h + b.size * 2;
  const body = useAnimatedStyle(() => ({
    opacity: 1 - burst.value,
    transform: [
      { translateY: h + b.size - y.value * travel },
      { translateX: (reduce ? 0 : Math.sin(y.value * Math.PI * 3 + b.phase) * b.sway) + shake.value },
      { scale: 1 + 0.45 * burst.value },
    ],
  }));
  // The ring and the label stay where the bubble was popped.
  const ring = useAnimatedStyle(() => ({
    opacity: burst.value > 0 ? 1 - burst.value : 0,
    transform: [{ translateY: h + b.size - y.value * travel }, { scale: 0.9 + 0.9 * burst.value }],
  }));
  const label = useAnimatedStyle(() => ({
    opacity: burst.value > 0 ? 1 - Math.max(0, burst.value - 0.5) * 2 : 0,
    transform: [{ translateY: h + b.size * 0.25 - y.value * travel - 50 * burst.value }],
  }));

  const press = () => {
    if (result) return;
    const r = onPop(b);
    setResult(r);
    if (!r.right) {
      // Wrong one: a shake, then it keeps floating (no burst, no penalty beyond the combo).
      shake.value = withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 70 }), withTiming(-5, { duration: 60 }), withSpring(0, spring.snappy));
      setTimeout(() => setResult(null), 400);
      return;
    }
    cancelAnimation(y);
    burst.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) });
    setTimeout(() => onGone(b.id), 360);
  };

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.ring, { left: b.x, width: b.size, height: b.size, borderRadius: b.size / 2 }, ring]} />
      <Animated.View style={[styles.bubbleWrap, { left: b.x, width: b.size, height: b.size }, body]}>
        <Pressable onPressIn={press} style={[styles.bubble, { borderRadius: b.size / 2, backgroundColor: b.tint }]} accessibilityRole="button" accessibilityLabel={t('play.bubble', { symbol: b.symbol })}>
          <View style={[styles.shine, { width: b.size * 0.28, height: b.size * 0.16, borderRadius: b.size }]} />
          <Text style={{ fontSize: b.size * 0.44 }}>{b.symbol}</Text>
        </Pressable>
      </Animated.View>
      {result && (
        <Animated.Text pointerEvents="none" style={[styles.label, { left: b.x, width: b.size }, !result.right && { color: color.ember }, label]}>
          {result.label}
        </Animated.Text>
      )}
    </>
  );
}

/** Three big soft lights drifting behind the bubbles, so the screen is never dead still. */
function Ambient() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Orb tint="rgba(120,166,255,0.10)" size={340} x={-80} y={80} dur={9000} />
      <Orb tint="rgba(255,90,60,0.08)" size={300} x={160} y={380} dur={11000} />
      <Orb tint="rgba(79,227,176,0.07)" size={260} x={40} y={620} dur={13000} />
    </View>
  );
}

function Orb({ tint, size, x, y, dur }: { tint: string; size: number; x: number; y: number; dur: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [dur, reduce, t]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: 40 * t.value }, { translateY: -30 * t.value }, { scale: 1 + 0.15 * t.value }] }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: size / 2, backgroundColor: tint }, anim]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink, overflow: 'hidden' },
  bubbleWrap: { position: 'absolute', top: 0 },
  bubble: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(244,243,239,0.45)' },
  shine: { position: 'absolute', top: '16%', left: '20%', backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-30deg' }] },
  ring: { position: 'absolute', top: 0, borderWidth: 3, borderColor: 'rgba(244,243,239,0.8)' },
  label: { position: 'absolute', top: 0, textAlign: 'center', color: color.text, fontFamily: font.display, fontSize: 22 },
  targetWrap: { position: 'absolute', left: 0, right: 0, top: 110, alignItems: 'center' },
  target: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(20,20,27,0.8)', borderWidth: 1, borderColor: color.line },
  targetText: { color: color.text2, fontFamily: font.semibold, fontSize: 15 },
  targetEmoji: { fontSize: 28 },
  mult: { color: color.ember, fontFamily: font.display, fontSize: 18 },
});
