import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { color } from '@/theme/tokens';

const COLORS = [color.ember, '#4FE3B0', '#78A6FF', '#FFD25E', '#C3A2FF', color.text];

type Piece = { dx: number; dy: number; rot: number; size: number; tint: string; delay: number; round: boolean };

/** A one-shot burst from (x, y). Remount (new `key`) to fire again. */
export function Confetti({ x, y, count = 28, spread = 1 }: { x: number; y: number; count?: number; spread?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const dist = (90 + Math.random() * 120) * spread;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist - 60 * spread,
          rot: (Math.random() - 0.5) * 720,
          size: 6 + Math.random() * 6,
          tint: COLORS[i % COLORS.length],
          delay: Math.random() * 80,
          round: i % 3 === 0,
        };
      }),
    [count, spread],
  );
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}>
      {pieces.map((p, i) => (
        <Bit key={i} p={p} x={x} y={y} />
      ))}
    </View>
  );
}

function Bit({ p, x, y }: { p: Piece; x: number; y: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(p.delay, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }));
  }, [p.delay, t]);
  const anim = useAnimatedStyle(() => {
    // Out fast, then gravity pulls it down while it fades.
    const fall = 140 * t.value * t.value;
    return {
      opacity: 1 - Math.max(0, (t.value - 0.6) / 0.4),
      transform: [{ translateX: p.dx * t.value }, { translateY: p.dy * t.value + fall }, { rotate: `${p.rot * t.value}deg` }],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: x - p.size / 2, top: y - p.size / 2, width: p.size, height: p.round ? p.size : p.size * 0.5, borderRadius: p.round ? p.size / 2 : 1, backgroundColor: p.tint },
        anim,
      ]}
    />
  );
}
