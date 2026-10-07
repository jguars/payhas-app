import { ReactNode, useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { spring } from '@/theme/motion';

/** Gives its child a quick swell-and-settle whenever `on` turns true. */
export function Pop({ on, children, peak = 1.28 }: { on: boolean; children: ReactNode; peak?: number }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    s.value = on ? withSequence(withTiming(peak, { duration: 90 }), withSpring(1, spring.bouncy)) : withSequence(withTiming(0.86, { duration: 80 }), withSpring(1, spring.snappy));
  }, [on, peak, reduce, s]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}
