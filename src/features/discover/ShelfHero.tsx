import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, interpolate, SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { MediaFade } from '@/components/ui/MediaFade';
import { FeedVideo } from '@/features/feed/data';
import { topicLabel, useT } from '@/i18n';
import { color, control, font, iconSize, media, radius, space, themedStyles, tracking, type } from '@/theme/tokens';

import type { Topic } from './useDiscover';

/** Shorter than before: today's video leads, the topic rows below it are the point. */
const HEIGHT = control.lg * 4.5;

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
 * Today's video (after Netflix Kids): the lead clip looping muted behind a
 * slow push, "TODAY · TOPIC", its caption and one white Play button over a
 * bottom fade. Calm: no pulsing ring, no equalizer.
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
        <Image source={lead.thumb} cachePolicy="memory-disk" style={styles.fill} contentFit="cover" alt="" accessible={false} aria-hidden />
        <VideoView player={player} style={styles.fill} contentFit="cover" nativeControls={false} pointerEvents="none" />
      </Animated.View>
      <MediaFade />

      <View style={styles.copy}>
        <Text style={styles.kicker} numberOfLines={1}>
          {t('discover.today', { topic: topicLabel(t, topic.slug, topic.label) }).toLocaleUpperCase(lang)}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {lead.caption}
        </Text>
        <PressScale
          onPress={onPlay}
          pressedScale={0.94}
          accessibilityRole="button"
          accessibilityLabel={t('discover.playVideos', { count: videos.length })}
          style={styles.play}
        >
          <Icon name="play" size={iconSize.sm} color={color.ink} />
          <Text style={styles.playText} numberOfLines={1}>
            {t('discover.play')}
          </Text>
        </PressScale>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  // Explicit size: react-native-web lays images out at natural size under absoluteFill alone.
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  card: { height: HEIGHT, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.surface1 },
  media: { position: 'absolute', left: 0, right: 0, top: -space.xl, bottom: -space.xl },
  copy: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, alignItems: 'flex-start', gap: space.xs },
  kicker: { color: media.text2, fontFamily: font.bold, ...type.caption, letterSpacing: tracking.caption * 3 },
  title: { color: media.text, fontFamily: font.title, ...type.title, marginBottom: space.sm },
  play: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: control.md, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: media.text },
  playText: { color: color.ink, fontFamily: font.bold, ...type.body },
}));
