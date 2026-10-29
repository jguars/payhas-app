import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Rect } from 'react-native-svg';

import { alpha, color, font, lane as lanes } from '@/theme/tokens';

import { BUBBLES, MEMORY } from './shared';
import type { GameMeta } from './types';

const formatTime = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

export const bubblesMeta: GameMeta = {
  id: 'bubbles',
  name: 'play.bubbles.name',
  sub: (lane, t) => (BUBBLES[lane].targets ? t('play.bubbles.subTargets', { s: BUBBLES[lane].round ?? 0 }) : t('play.bubbles.subFree')),
  tint: lanes.teen.color,
  Scene: BubblesScene,
  best: { format: (n, _lane, t) => t('play.ptsShort', { count: n }), stars: (n) => (n >= 40 ? 3 : n >= 20 ? 2 : 1) },
};

export const memoryMeta: GameMeta = {
  id: 'memory',
  name: 'play.memory.name',
  sub: (lane, t) => t(MEMORY[lane].timed ? 'play.memory.subTimed' : 'play.memory.sub', { count: MEMORY[lane].pairs }),
  tint: lanes.little.color,
  Scene: MemoryScene,
  best: {
    format: (n, lane, t) => (MEMORY[lane].timed ? formatTime(n) : t('play.moves', { count: n })),
    // Lower is better: fewer moves, or fewer seconds against the clock.
    stars: (n, lane) => {
      const m = MEMORY[lane];
      const per = n / m.pairs;
      return m.timed ? (per <= 4 ? 3 : per <= 6 ? 2 : 1) : per <= 1.5 ? 3 : per <= 2 ? 2 : 1;
    },
    hiddenFor: ['little'],
  },
};

/** Underwater scene: a few still background bubbles, critters in bubbles drifting up on a loop. */
function BubblesScene({ active }: { active: boolean }) {
  const specs = [
    { x: '8%', s: 54, d: 0, e: '🐸' },
    { x: '30%', s: 40, d: 900, e: '🐥' },
    { x: '50%', s: 62, d: 400, e: '🐼' },
    { x: '72%', s: 44, d: 1500, e: '🦊' },
    { x: '86%', s: 34, d: 2300, e: '🐙' },
  ];
  return (
    <>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 340 170" preserveAspectRatio="xMidYMid slice">
        <Circle cx={30} cy={40} r={10} fill="none" stroke={color.ink} strokeOpacity={0.18} strokeWidth={3} />
        <Circle cx={300} cy={30} r={14} fill="none" stroke={color.ink} strokeOpacity={0.18} strokeWidth={3} />
        <Circle cx={250} cy={120} r={6} fill="none" stroke={color.ink} strokeOpacity={0.18} strokeWidth={3} />
        <Circle cx={110} cy={130} r={8} fill="none" stroke={color.ink} strokeOpacity={0.18} strokeWidth={3} />
        <Rect x={0} y={150} width={340} height={20} fill={color.ink} opacity={0.12} />
      </Svg>
      {specs.map((b, i) => (
        <FloatBubble key={i} {...b} active={active} />
      ))}
    </>
  );
}

function FloatBubble({ x, s, d, e, active }: { x: string; s: number; d: number; e: string; active: boolean }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 0.5 : 0);
  useEffect(() => {
    if (reduce || !active) return;
    t.value = 0;
    t.value = withDelay(d, withRepeat(withTiming(1, { duration: 3400, easing: Easing.linear }), -1, false));
  }, [active, d, reduce, t]);
  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.1, 0.85, 1], [0, 1, 1, 0]),
    transform: [{ translateY: interpolate(t.value, [0, 1], [170, -s]) }, { translateX: Math.sin(t.value * Math.PI * 2) * 8 }],
  }));
  return (
    <Animated.View style={[styles.bubble, { left: x as `${number}%`, width: s, height: s, borderRadius: s / 2 }, anim]}>
      <Text style={{ fontSize: s * 0.46 }}>{e}</Text>
    </Animated.View>
  );
}

/** Four outlined cards on a table, flipping in turn; one pair matches. */
function MemoryScene({ active }: { active: boolean }) {
  const faces = ['🐻', '🐰', '🐻', '🐢'];
  return (
    <>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 340 170" preserveAspectRatio="xMidYMid slice">
        <Circle cx={36} cy={34} r={5} fill={color.ink} opacity={0.15} />
        <Circle cx={304} cy={46} r={7} fill={color.ink} opacity={0.15} />
        <Circle cx={290} cy={140} r={4} fill={color.ink} opacity={0.15} />
        <Circle cx={52} cy={136} r={6} fill={color.ink} opacity={0.15} />
      </Svg>
      <View style={styles.miniGrid}>
        {faces.map((f, i) => (
          <MiniCard key={i} face={f} index={i} delay={[0, 700, 350, 1050][i]} active={active} />
        ))}
      </View>
    </>
  );
}

function MiniCard({ face, index, delay, active }: { face: string; index: number; delay: number; active: boolean }) {
  const reduce = useReducedMotion();
  const f = useSharedValue(0);
  useEffect(() => {
    if (reduce || !active) return;
    f.value = 0;
    f.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 380, easing: Easing.out(Easing.back(1.4)) }), withDelay(1300, withTiming(0, { duration: 320 })), withDelay(800, withTiming(0, { duration: 0 }))),
        -1,
        false,
      ),
    );
  }, [active, delay, reduce, f]);
  const back = useAnimatedStyle(() => ({ opacity: f.value < 0.5 ? 1 : 0, transform: [{ perspective: 500 }, { rotateY: `${f.value * 180}deg` }] }));
  const front = useAnimatedStyle(() => ({ opacity: f.value >= 0.5 ? 1 : 0, transform: [{ perspective: 500 }, { rotateY: `${(f.value - 1) * 180}deg` }] }));
  // A slight fan so the cards read as a hand laid on a table.
  const tilt = [-6, -2, 2, 6][index];
  return (
    <View style={[styles.miniCard, { transform: [{ rotate: `${tilt}deg` }] }]}>
      <Animated.View style={[styles.miniFace, styles.miniBack, back]}>
        <Text style={styles.miniMark}>?</Text>
      </Animated.View>
      <Animated.View style={[styles.miniFace, styles.miniFront, front]}>
        <Text style={{ fontSize: 22 }}>{face}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', top: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.ink, backgroundColor: alpha(color.white, 0.45) },
  miniGrid: { flexDirection: 'row', gap: 8 },
  miniCard: { width: 36, height: 48 },
  miniFace: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', borderRadius: 10, borderWidth: 2, borderColor: color.ink, alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden' },
  miniBack: { backgroundColor: color.surface2 },
  miniMark: { color: lanes.little.color, fontFamily: font.display, fontSize: 18 },
  miniFront: { backgroundColor: color.text },
});
