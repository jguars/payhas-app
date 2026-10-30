import { useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { spring } from '@/theme/motion';
import { alpha, color } from '@/theme/tokens';

export type NavKind = 'home' | 'discover' | 'play' | 'inbox' | 'me';

const INK = color.ink;
const W = color.white;

/**
 * Hand-drawn tab icons. Resting: a quiet outline. Active: white-filled with
 * ink lines (it sits on the coloured pill), and each one has its own little
 * move when it becomes active — home hops, the compass needle spins, the
 * controller wiggles, the bell rings, the person pops.
 */
export function NavIcon({ kind, active, size = 26 }: { kind: NavKind; active: boolean; size?: number }) {
  const reduce = useReducedMotion();
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const sc = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return; // no flourish on first paint
    }
    if (!active || reduce) return;
    const settle = (v: number) => withSpring(v, spring.bouncy);
    switch (kind) {
      case 'home':
        ty.value = withSequence(withTiming(-7, { duration: 130 }), settle(0));
        sc.value = withSequence(withTiming(0.9, { duration: 90 }), withTiming(1.08, { duration: 120 }), settle(1));
        break;
      case 'discover':
        rot.value = 0;
        rot.value = withSpring(360, { damping: 14, stiffness: 120 }, () => {
          rot.value = 0;
        });
        break;
      case 'play':
        rot.value = withSequence(
          withTiming(-14, { duration: 80 }),
          withTiming(12, { duration: 90 }),
          withTiming(-8, { duration: 90 }),
          withTiming(5, { duration: 90 }),
          settle(0),
        );
        break;
      case 'inbox':
        rot.value = withSequence(
          withTiming(18, { duration: 90 }),
          withTiming(-16, { duration: 100 }),
          withTiming(11, { duration: 100 }),
          withTiming(-7, { duration: 100 }),
          settle(0),
        );
        break;
      case 'me':
        sc.value = withSequence(withTiming(1.25, { duration: 130 }), settle(1));
        ty.value = withSequence(withTiming(-3, { duration: 130 }), settle(0));
        break;
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { rotate: `${rot.value}deg` }, { scale: sc.value }],
  }));

  // Active sits on the inverse pill: its outline takes onInverse, with the fill one step softer.
  const stroke = active ? color.onInverse : color.text3;
  const fill = active ? (color.scheme === 'light' ? alpha(color.onInverse, 0.25) : W) : 'none';
  const line = { stroke, strokeWidth: active ? 2 : 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  return (
    <Animated.View style={[{ width: size, height: size, transformOrigin: kind === 'inbox' ? 'top' : 'center' }, anim]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {kind === 'home' && (
          <>
            <Path d="M3.8 11.2 12 4l8.2 7.2v8.3a1.6 1.6 0 0 1-1.6 1.6h-3.7v-5.6H9.1v5.6H5.4a1.6 1.6 0 0 1-1.6-1.6z" fill={fill} {...line} />
            {active && <Circle cx={12} cy={10.6} r={1.5} fill={INK} />}
          </>
        )}
        {kind === 'discover' && (
          <>
            <Circle cx={12} cy={12} r={9} fill={fill} {...line} />
            <Path d="M15.6 8.4 13.7 13.7 8.4 15.6 10.3 10.3z" fill={active ? INK : 'none'} {...line} />
            {active && <Circle cx={12} cy={12} r={1.2} fill={W} />}
          </>
        )}
        {kind === 'play' && (
          <>
            <Path d="M7.2 7.4h9.6a4.4 4.4 0 0 1 4.3 3.5l.9 4.7a2.6 2.6 0 0 1-4.6 2.1L15.8 16H8.2l-1.6 1.7A2.6 2.6 0 0 1 2 15.6l.9-4.7a4.4 4.4 0 0 1 4.3-3.5z" fill={fill} {...line} />
            <Path d="M8 10.3v3.4M6.3 12h3.4" {...line} fill="none" />
            <Circle cx={15.6} cy={10.9} r={1.05} fill={stroke} />
            <Circle cx={17.6} cy={13} r={1.05} fill={stroke} />
          </>
        )}
        {kind === 'inbox' && (
          <>
            <Path d="M6 16.4V11a6 6 0 1 1 12 0v5.4l1.7 2.1H4.3z" fill={fill} {...line} />
            <Path d="M10 20.6a2 2 0 0 0 4 0" {...line} fill="none" />
            {active && <Path d="M9.2 9.6a3 3 0 0 1 2.4-2.3" stroke={INK} strokeWidth={1.6} strokeLinecap="round" fill="none" />}
          </>
        )}
        {kind === 'me' && (
          <>
            <Circle cx={12} cy={8.6} r={3.9} fill={fill} {...line} />
            <Path d="M4.6 20.2a7.4 7.4 0 0 1 14.8 0z" fill={fill} {...line} />
            {active && <Path d="M10.4 9.4a2 2 0 0 0 3.2 0" stroke={INK} strokeWidth={1.4} strokeLinecap="round" fill="none" />}
          </>
        )}
      </Svg>
    </Animated.View>
  );
}
