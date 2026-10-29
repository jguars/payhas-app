import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { useFamily } from '@/features/family/FamilyProvider';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { color, font, radius, space, themedStyles } from '@/theme/tokens';

import { hourLabel, Lock } from './useScreenTime';

const STARS = [
  { x: -78, y: -54, s: 6, d: 0 },
  { x: 70, y: -70, s: 4, d: 400 },
  { x: 92, y: 6, s: 5, d: 900 },
  { x: -96, y: 22, s: 4, d: 1300 },
  { x: -40, y: -96, s: 3, d: 650 },
];

/** Full-screen stop shown over the feed when the family controls say so. */
export function TimesUp({ lock }: { lock: Exclude<Lock, null> }) {
  const { leaveProfile, current } = useFamily();
  const { t, lang } = useT();
  const quiet = lock === 'quiet';
  // Little ones may not read yet: every action carries a big icon that says it on its own.
  const little = current?.lane === 'little';
  const copy = {
    paused: { title: t('me.stop.pausedTitle'), body: t('me.stop.pausedBody') },
    quiet: { title: t('me.quietHours'), body: t('me.stop.quietBody', { time: hourLabel(current?.wake_hour ?? 7, lang) }) },
    limit: { title: t('me.stop.limitTitle'), body: t('me.stop.limitBody') },
    games: { title: t('me.stop.gamesTitle'), body: t('me.stop.gamesBody') },
  }[lock];
  // A gentle three-note "goodnight" when the stop screen appears.
  useEffect(() => fx.timesUp(), []);

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.root}>
      <Enter index={0} rise={10}>
        <View style={styles.art}>
          {quiet && STARS.map((st, i) => <Star key={i} {...st} />)}
          <Float>{quiet ? <Moon /> : lock === 'paused' ? <PauseArt /> : lock === 'games' ? <GamesOff /> : <Hourglass />}</Float>
        </View>
      </Enter>
      <Enter index={2}>
        <Text style={styles.title}>{copy.title}</Text>
      </Enter>
      <Enter index={3}>
        <Text style={styles.body}>{copy.body}</Text>
      </Enter>
      {lock === 'limit' && (
        <Enter index={4}>
          <AskForTime little={little} />
        </Enter>
      )}
      <Enter index={5}>
        <PressScale onPress={lock === 'games' ? () => router.navigate('/') : leaveProfile} accessibilityRole="button" style={[styles.button, little && styles.big]}>
          <Icon name={lock === 'games' ? 'play' : 'me'} filled size={little ? 28 : 18} color={color.text} />
          <Text style={styles.buttonText}>{lock === 'games' ? t('me.stop.watchVideos') : t('me.switchProfile')}</Text>
        </PressScale>
      </Enter>
    </Animated.View>
  );
}

type Ask = 'idle' | 'sending' | 'waiting' | 'declined' | 'too_many' | 'error';

/**
 * "Ask for more time": sends a request to the parent's phone. If a parent
 * says yes, the extra minutes arrive over Realtime and this screen goes away
 * by itself; while waiting it checks for a "not today" every 8 seconds.
 */
function AskForTime({ little }: { little: boolean }) {
  const { active } = useFamily();
  const { t } = useT();
  const token = active?.token;
  const [state, setState] = useState<Ask>('idle');

  const check = async () => {
    if (!token) return;
    const { data } = await supabase.rpc('get_time_request', { p_session: token });
    const status = (data as { status?: string } | null)?.status;
    if (status === 'pending') setState('waiting');
    else if (status === 'declined') setState((s) => (s === 'waiting' ? 'declined' : s));
  };

  // Pick up a request already sent from this screen earlier.
  useEffect(() => {
    check();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state !== 'waiting') return;
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async () => {
    if (!token) return;
    fx.send();
    setState('sending');
    const { data, error } = await supabase.rpc('request_more_time', { p_session: token });
    if (error) {
      fx.error();
      return setState('error');
    }
    setState(data === 'too_many' ? 'too_many' : 'waiting');
  };

  if (state === 'idle' || state === 'sending' || state === 'error') {
    return (
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <PressScale onPress={ask} disabled={state === 'sending'} accessibilityRole="button" style={[styles.ask, little && styles.big]}>
          <Icon name="clock" size={little ? 28 : 18} color={color.ink} strokeWidth={2.4} />
          <Text style={styles.askText}>{t('me.ask.button')}</Text>
        </PressScale>
        {state === 'error' && <Text style={[styles.askNote, { textAlign: 'center' }]}>{t('me.ask.error')}</Text>}
      </View>
    );
  }
  const note = {
    waiting: t('me.ask.waiting'),
    declined: t('me.ask.declined'),
    too_many: t('me.ask.tooMany'),
  }[state];
  return (
    <View style={styles.askState}>
      {state === 'waiting' && <Pulse />}
      <Text style={[styles.askNote, { flexShrink: 1 }]} numberOfLines={2}>
        {note}
      </Text>
    </View>
  );
}

/** Three dots breathing in turn while the request is out. */
function Pulse() {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <Breath key={i} delay={i * 180} />
      ))}
    </View>
  );
}

function Breath({ delay }: { delay: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [delay, reduce, t]);
  const anim = useAnimatedStyle(() => ({ opacity: 0.3 + 0.7 * t.value, transform: [{ scale: 0.8 + 0.2 * t.value }] }));
  return <Animated.View style={[styles.breath, anim]} />;
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

function PauseArt() {
  return (
    <Svg width={92} height={92} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} fill={color.verified} opacity={0.18} />
      <Path d="M9.5 8v8M14.5 8v8" stroke={color.verified} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function GamesOff() {
  return (
    <Svg width={92} height={92} viewBox="0 0 24 24">
      <Path d="M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L14.5 13h-5l-1.1 1.8A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4z" stroke={color.text2} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
      <Path d="M4 4l16 16" stroke={color.ember} strokeWidth={1.8} strokeLinecap="round" />
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

const styles = themedStyles(() => ({
  root: { ...StyleSheet.absoluteFill, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  art: { width: 220, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  star: { position: 'absolute', backgroundColor: color.text, left: '50%', top: '50%' },
  title: { color: color.text, fontFamily: font.display, fontSize: 28, textAlign: 'center', letterSpacing: -0.6 },
  body: { color: color.text2, fontFamily: font.medium, fontSize: 16, textAlign: 'center' },
  ask: { minHeight: 48, paddingHorizontal: space.xxl, borderRadius: radius.pill, backgroundColor: color.reward, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginTop: space.lg },
  askText: { color: color.ink, fontFamily: font.bold, fontSize: 15 },
  askState: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, height: 48 },
  askNote: { color: color.text2, fontFamily: font.semibold, fontSize: 14 },
  breath: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.reward },
  button: { marginTop: space.xl, minHeight: 48, paddingHorizontal: space.xxl, borderRadius: radius.pill, backgroundColor: color.surface2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  big: { minHeight: 64, paddingHorizontal: space.xl },
  buttonText: { color: color.text, fontFamily: font.bold, fontSize: 15 },
}));
