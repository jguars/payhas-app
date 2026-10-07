import { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { spring, stagger } from '@/theme/motion';

type Props = {
  children: ReactNode;
  /** Position in its group; each step adds STAGGER_MS of delay. */
  index?: number;
  delay?: number;
  /** Distance travelled upward while fading in, in px. */
  rise?: number;
  style?: StyleProp<ViewStyle>;
};

/** Fades and rises its children into place on mount, staggered by `index`. */
export function Enter({ children, index = 0, delay = 0, rise = 14, style }: Props) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (!reduce) p.value = withDelay(delay + stagger(index), withSpring(1, spring.smooth));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const anim = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value),
    transform: [{ translateY: (1 - p.value) * rise }, { scale: 0.98 + 0.02 * p.value }],
  }));

  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
