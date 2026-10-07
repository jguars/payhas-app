import { forwardRef, ReactNode } from 'react';
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { spring } from '@/theme/motion';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale while held. 0.96 for tiles, ~0.92 for small buttons. */
  pressedScale?: number;
};

/** A Pressable that dips slightly while held and springs back on release. */
export const PressScale = forwardRef<View, Props>(function PressScale(
  { children, style, pressedScale = 0.96, onPressIn, onPressOut, ...rest },
  ref,
) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <Pressable
      ref={ref}
      onPressIn={(e) => {
        s.value = withSpring(pressedScale, spring.snappy);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, spring.bouncy);
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
});
