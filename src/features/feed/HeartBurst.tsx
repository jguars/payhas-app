import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { color } from '@/theme/tokens';

const SIZE = 96;

/** Double-tap heart: pops in tilted at the tap, settles, then lifts away with a few sparks. */
export function HeartBurst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const tilt = useMemo(() => (Math.random() - 0.5) * 30, []);
  const s = useSharedValue(0.3);
  const lift = useSharedValue(0);
  const o = useSharedValue(1);

  useEffect(() => {
    s.value = withSequence(withSpring(1.25, { damping: 9, stiffness: 320 }), withSpring(1, { damping: 14, stiffness: 220 }));
    lift.value = withDelay(420, withTiming(1, { duration: 420, easing: Easing.in(Easing.quad) }));
    o.value = withDelay(460, withTiming(0, { duration: 380 }));
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const heart = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: -90 * lift.value }, { scale: s.value * (1 - 0.25 * lift.value) }, { rotate: `${tilt}deg` }],
  }));

  return (
    <View pointerEvents="none" style={[styles.at, { left: x - SIZE / 2, top: y - SIZE / 2 }]}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Spark key={i} angle={(i / 6) * Math.PI * 2 + tilt / 40} />
      ))}
      <Animated.View style={heart}>
        <Icon name="heart" size={SIZE} color={color.ember} filled />
      </Animated.View>
    </View>
  );
}

function Spark({ angle }: { angle: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(60, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [t]);
  const anim = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateX: Math.cos(angle) * 70 * t.value }, { translateY: Math.sin(angle) * 70 * t.value }, { scale: 1 - 0.5 * t.value }],
  }));
  return <Animated.View style={[styles.spark, anim]} />;
}

const styles = StyleSheet.create({
  at: { position: 'absolute', width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFD25E' },
});
