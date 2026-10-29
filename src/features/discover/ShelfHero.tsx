import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
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
import { topicLabel, useT } from '@/i18n';
import { alpha, color, font, media, radius, size, themedStyles } from '@/theme/tokens';

import type { Topic } from './useDiscover';

const HEIGHT = 420;

type Props = {
  topic: Topic;
  videos: FeedVideo[];
  /** The lead video's topics, already in the app's language. */
  tags: string[];
  scrollY: SharedValue<number>;
  playing: boolean;
  onPlay: () => void;
};

/**
 * The featured card (after Netflix Kids): a tall poster with the lead clip
 * looping muted behind a slow push, caption and "A • B" tags over a bottom
 * gradient, and one white Play pill.
 */
export function ShelfHero({ topic, videos, tags, scrollY, playing, onPlay }: Props) {
  const reduce = useReducedMotion();
  const { t, lang } = useT();
  const lead = videos[0];

  const player = useVideoPlayer(lead.source, (p) => {
    p.loop = true;
    p.muted = true;
  });
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);

  // Slow push: 1.04 → 1.09 and back keeps the card alive without drawing the eye.
  const push = useSharedValue(0);
  useEffect(() => {
    if (!reduce) push.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, push]);

  const media = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-100, 0, 400], [-16, 0, 24], 'clamp') },
      { scale: 1.04 + 0.05 * push.value },
    ],
  }));

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.media, media]}>
        {/* Poster under the video so the card is never blank while it buffers. */}
        <Image source={lead.thumb} cachePolicy="memory-disk" style={styles.fill} contentFit="cover" />
        <VideoView player={player} style={styles.fill} contentFit="cover" nativeControls={false} pointerEvents="none" />
      </Animated.View>
      <View pointerEvents="none" style={styles.fade} />

      <View style={styles.kicker}>
        <Equalizer />
        <Text style={styles.kickerText} numberOfLines={1}>
          {t('discover.shelf', { topic: topicLabel(t, topic.slug, topic.label) }).toLocaleUpperCase(lang)}
        </Text>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>
          {lead.caption}
        </Text>
        {tags.length > 0 && (
          <Text style={styles.tags} numberOfLines={1}>
            {tags.join('  •  ')}
          </Text>
        )}
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

/** White Play pill with a soft ember ring breathing out behind it. */
function PlayPill({ count, onPress }: { count: number; onPress: () => void }) {
  const reduce = useReducedMotion();
  const { t } = useT();
  const ring = useSharedValue(0);
  useEffect(() => {
    if (!reduce) ring.value = withDelay(900, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false));
  }, [reduce, ring]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.15, 1], [0, 0.5, 0]),
    transform: [{ scaleX: 1 + 0.12 * ring.value }, { scaleY: 1 + 0.4 * ring.value }],
  }));

  return (
    <View style={styles.pillWrap}>
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      <PressScale
        onPress={onPress}
        pressedScale={0.94}
        accessibilityRole="button"
        accessibilityLabel={t('discover.playVideos', { count })}
        style={styles.pill}
      >
        <Icon name="play" size={16} color={color.ink} />
        <Text style={styles.pillText} numberOfLines={1}>
          {t('discover.play')}
        </Text>
      </PressScale>
    </View>
  );
}

const styles = themedStyles(() => ({
  // Explicit size: react-native-web lays images out at natural size under absoluteFill alone.
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  card: { height: HEIGHT, borderRadius: 24, overflow: 'hidden', backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line },
  media: { position: 'absolute', left: 0, right: 0, top: -28, bottom: -28 },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
    experimental_backgroundImage: 'linear-gradient(0deg, rgba(10,10,15,0.96) 12%, rgba(10,10,15,0.7) 45%, rgba(10,10,15,0))',
  },
  kicker: {
    position: 'absolute',
    left: 14,
    top: 14,
    maxWidth: '80%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: alpha(color.ink, 0.6),
  },
  kickerText: { flexShrink: 1, color: color.ember, fontFamily: font.bold, fontSize: size.caption, letterSpacing: 0.7 },
  copy: { position: 'absolute', left: 20, right: 20, bottom: 20, alignItems: 'center', gap: 10 },
  title: { color: media.text, fontFamily: font.title, fontSize: size.heading, lineHeight: 34, letterSpacing: -0.4, textAlign: 'center' },
  tags: { color: media.text2, fontFamily: font.semibold, fontSize: size.small },
  eq: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 11 },
  bar: { width: 3, height: 11, borderRadius: 1.5, backgroundColor: color.ember, transformOrigin: 'bottom' },
  pillWrap: { marginTop: 4, alignSelf: 'stretch' },
  ring: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.pill, backgroundColor: color.ember },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.pill, backgroundColor: media.text },
  pillText: { color: color.ink, fontFamily: font.bold, fontSize: size.body },
}));
