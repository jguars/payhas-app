import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { FeedVideo } from '@/features/feed/data';
import { color, font, radius } from '@/theme/tokens';

import type { Topic } from './useDiscover';

const HEIGHT = 176;

type Props = {
  topic: Topic;
  videos: FeedVideo[];
  scrollY: SharedValue<number>;
  playing: boolean;
  onPlay: () => void;
};

/**
 * The featured shelf. A muted clip loops behind a slow push-in, drifts with
 * the scroll (parallax), and an equalizer pulses beside the kicker.
 */
export function ShelfHero({ topic, videos, scrollY, playing, onPlay }: Props) {
  const reduce = useReducedMotion();
  const lead = videos[0];

  const player = useVideoPlayer(lead.source, (p) => {
    p.loop = true;
    p.muted = true;
  });
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);

  // Slow push: 1.0 → 1.08 and back over 12s keeps the card alive without drawing the eye.
  const push = useSharedValue(0);
  useEffect(() => {
    if (!reduce) push.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, push]);

  const media = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-100, 0, 300], [-24, 0, 60], 'clamp') },
      { scale: 1.06 + 0.06 * push.value },
    ],
  }));

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.media, media]}>
        {/* Poster under the video so the card is never blank while it buffers. */}
        <Image source={lead.thumb} style={styles.fill} resizeMode="cover" />
        <VideoView player={player} style={styles.fill} contentFit="cover" nativeControls={false} pointerEvents="none" />
      </Animated.View>
      <View pointerEvents="none" style={styles.fade} />

      <View style={styles.copy}>
        <View style={{ gap: 6 }}>
          <View style={styles.kickerRow}>
            <Equalizer />
            <Text style={styles.kicker}>{topic.label.toUpperCase()} SHELF</Text>
          </View>
          <Text style={styles.title} numberOfLines={3}>
            {lead.caption}
          </Text>
        </View>
        <PlayPill count={videos.length} onPress={onPlay} />
      </View>
    </View>
  );
}

/** Three bars bouncing out of phase — reads as "this one sings". */
function Equalizer() {
  const reduce = useReducedMotion();
  return (
    <View style={styles.eq} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((i) => (
        <Bar key={i} i={i} still={reduce} />
      ))}
    </View>
  );
}

function Bar({ i, still }: { i: number; still: boolean }) {
  const h = useSharedValue(0.4);
  useEffect(() => {
    if (still) return;
    const d = [380, 300, 440][i];
    const peaks = [
      [1, 0.35, 0.8, 0.5],
      [0.55, 1, 0.3, 0.9],
      [0.8, 0.45, 1, 0.3],
    ][i];
    h.value = withDelay(
      i * 90,
      withRepeat(withSequence(...peaks.map((p) => withTiming(p, { duration: d, easing: Easing.inOut(Easing.quad) }))), -1, true),
    );
  }, [i, still, h]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scaleY: h.value }] }));
  return <Animated.View style={[styles.bar, anim]} />;
}

/** White play pill with a soft ember ring breathing out behind it. */
function PlayPill({ count, onPress }: { count: number; onPress: () => void }) {
  const reduce = useReducedMotion();
  const ring = useSharedValue(0);
  useEffect(() => {
    if (!reduce) ring.value = withDelay(900, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false));
  }, [reduce, ring]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.15, 1], [0, 0.55, 0]),
    transform: [{ scaleX: 1 + 0.18 * ring.value }, { scaleY: 1 + 0.45 * ring.value }],
  }));

  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      <PressScale onPress={onPress} pressedScale={0.92} accessibilityRole="button" accessibilityLabel={`Play ${count} videos`} style={styles.pill}>
        <Icon name="play" size={12} color={color.ink} />
        <Text style={styles.pillText}>
          Play {count} {count === 1 ? 'video' : 'videos'}
        </Text>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  // Explicit size: react-native-web lays images out at natural size under absoluteFill alone.
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  card: { height: HEIGHT, borderRadius: 24, overflow: 'hidden', backgroundColor: color.surface1 },
  media: { position: 'absolute', right: 0, top: -20, width: 210, height: HEIGHT + 40 },
  fade: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 270,
    experimental_backgroundImage: `linear-gradient(90deg, ${color.surface1} 52%, rgba(20,20,27,0))`,
  },
  copy: { position: 'absolute', left: 18, top: 18, bottom: 18, width: 196, justifyContent: 'space-between' },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  kicker: { color: '#FF7A5E', fontFamily: font.bold, fontSize: 12, letterSpacing: 0.7 },
  title: { color: color.text, fontFamily: font.title, fontSize: 21, lineHeight: 24 },
  eq: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 11 },
  bar: { width: 3, height: 11, borderRadius: 1.5, backgroundColor: '#FF7A5E', transformOrigin: 'bottom' },
  ring: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.pill, backgroundColor: color.ember },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: color.text },
  pillText: { color: color.ink, fontFamily: font.bold, fontSize: 13 },
});
