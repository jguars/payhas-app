import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { useFamily } from '@/features/family/FamilyProvider';
import { color, font, radius, space } from '@/theme/tokens';

import { Lock, QUIET_END_HOUR } from './useScreenTime';

const STARS = [
  { x: -78, y: -54, s: 6, d: 0 },
  { x: 70, y: -70, s: 4, d: 400 },
  { x: 92, y: 6, s: 5, d: 900 },
  { x: -96, y: 22, s: 4, d: 1300 },
  { x: -40, y: -96, s: 3, d: 650 },
];

/** Full-screen stop shown over the feed when the family controls say so. */
export function TimesUp({ lock }: { lock: Exclude<Lock, null> }) {
  const { leaveProfile } = useFamily();
  const quiet = lock === 'quiet';

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.root}>
      <Enter index={0} rise={10}>
        <View style={styles.art}>
          {quiet && STARS.map((st, i) => <Star key={i} {...st} />)}
          <Float>{quiet ? <Moon /> : <Hourglass />}</Float>
        </View>
      </Enter>
      <Enter index={2}>
        <Text style={styles.title}>{quiet ? 'Quiet hours' : "That's today's watching"}</Text>
      </Enter>
      <Enter index={3}>
        <Text style={styles.body}>{quiet ? `Back at ${QUIET_END_HOUR}am` : 'Back tomorrow'}</Text>
      </Enter>
      <Enter index={5}>
        <PressScale onPress={leaveProfile} accessibilityRole="button" style={styles.button}>
          <Text style={styles.buttonText}>Switch profile</Text>
        </PressScale>
      </Enter>
    </Animated.View>
  );
}

/** Slow bob, like something drifting off to sleep. */
function Float({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, t]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: -6 + 12 * t.value }, { rotate: `${-4 + 8 * t.value}deg` }] }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}

function Star({ x, y, s, d }: { x: number; y: number; s: number; d: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) t.value = withDelay(d, withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [d, reduce, t]);
  const anim = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * t.value, transform: [{ scale: 0.6 + 0.4 * t.value }] }));
  return <Animated.View style={[styles.star, { width: s, height: s, borderRadius: s / 2, marginLeft: x, marginTop: y }, anim]} />;
}

function Moon() {
  return (
    <Svg width={96} height={96} viewBox="0 0 24 24">
      <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="#FFD25E" />
    </Svg>
  );
}

function Hourglass() {
  return (
    <Svg width={88} height={88} viewBox="0 0 24 24">
      <Path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" stroke={color.ember} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <Circle cx={12} cy={18.5} r={1.6} fill={color.ember} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  art: { width: 220, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  star: { position: 'absolute', backgroundColor: color.text, left: '50%', top: '50%' },
  title: { color: color.text, fontFamily: font.display, fontSize: 28, textAlign: 'center', letterSpacing: -0.6 },
  body: { color: color.text2, fontFamily: font.medium, fontSize: 16, textAlign: 'center' },
  button: { marginTop: space.xl, height: 48, paddingHorizontal: space.xxl, borderRadius: radius.pill, backgroundColor: color.surface2, justifyContent: 'center' },
  buttonText: { color: color.text, fontFamily: font.bold, fontSize: 15 },
});
