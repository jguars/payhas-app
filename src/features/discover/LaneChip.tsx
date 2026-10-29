import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { laneKey, useT } from '@/i18n';
import { spring } from '@/theme/motion';
import { font, Lane, lane as lanes, size, themedStyles } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Approximate path lengths in viewBox units; dasharray just needs to cover them.
const SHIELD_LEN = 56;
const CHECK_LEN = 10;

/** "Kids lane" — the shield outline draws itself, then the check ticks in. */
export function LaneChip({ lane, delay = 120 }: { lane: Lane; delay?: number }) {
  const l = lanes[lane];
  const { t } = useT();
  const label = t('discover.laneChip', { lane: t(laneKey(lane)) });
  const reduce = useReducedMotion();
  const pop = useSharedValue(reduce ? 1 : 0);
  const shield = useSharedValue(reduce ? 1 : 0);
  const check = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    pop.value = withDelay(delay, withSpring(1, spring.bouncy));
    shield.value = withDelay(delay + 80, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    check.value = withDelay(delay + 520, withTiming(1, { duration: 260, easing: Easing.out(Easing.back(2)) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const chip = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 1.4), transform: [{ scale: 0.8 + 0.2 * pop.value }] }));
  const shieldProps = useAnimatedProps(() => ({ strokeDashoffset: SHIELD_LEN * (1 - shield.value) }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - check.value) }));

  return (
    <Animated.View style={[styles.chip, { borderColor: l.color + '8C' }, chip]} accessibilityLabel={label}>
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <AnimatedPath
          d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
          stroke={l.color}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={SHIELD_LEN}
          animatedProps={shieldProps}
        />
        <AnimatedPath
          d="m9 12 2 2 4-4"
          stroke={l.color}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={CHECK_LEN}
          animatedProps={checkProps}
        />
      </Svg>
      <Text style={[styles.label, { color: l.color }]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = themedStyles(() => ({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingLeft: 7, paddingRight: 10, borderRadius: 999, borderWidth: 1 },
  label: { fontFamily: font.bold, fontSize: size.caption },
}));
