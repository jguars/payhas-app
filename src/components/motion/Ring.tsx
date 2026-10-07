import { useEffect } from 'react';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { spring } from '@/theme/motion';
import { color as c } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = { progress: number; size?: number; stroke?: number; color?: string; delay?: number };

/** A progress ring that sweeps to `progress` (0–1), starting at twelve o'clock. */
export function Ring({ progress, size = 22, stroke = 3, color = c.ember, delay = 0 }: Props) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const target = Math.min(1, Math.max(0, progress));
  const p = useSharedValue(reduce ? target : 0);

  useEffect(() => {
    p.value = reduce ? target : withDelay(delay, withSpring(target, spring.smooth));
  }, [target, delay, reduce, p]);

  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value) }));

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.line} strokeWidth={stroke} fill="none" />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={len}
        animatedProps={props}
      />
    </Svg>
  );
}
