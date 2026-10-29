import { useEffect } from 'react';

import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { spring } from '@/theme/motion';
import { color, themedStyles } from '@/theme/tokens';

/** A switch whose knob springs across and stretches a little mid-travel. Display only. */
export function Toggle({ on, tint = color.success }: { on: boolean; tint?: string }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(on ? 1 : 0, spring.snappy);
  }, [on, p]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(Math.min(1, Math.max(0, p.value)), [0, 1], [color.line, tint]),
  }));
  const knob = useAnimatedStyle(() => {
    const mid = 1 - Math.abs(p.value - 0.5) * 2; // 0 at the ends, 1 halfway
    return { transform: [{ translateX: 18 * p.value }, { scaleX: 1 + 0.25 * mid }] };
  });

  return (
    <Animated.View style={[styles.track, track]} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <Animated.View style={[styles.knob, knob]} />
    </Animated.View>
  );
}

const styles = themedStyles(() => ({
  track: { width: 48, height: 30, borderRadius: 15, padding: 3 },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: color.ink },
}));
