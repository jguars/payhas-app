import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
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

import { Icon } from '@/components/Icon';
import { CountUp } from '@/components/motion/CountUp';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { FeedVideo, formatCount } from '@/features/feed/data';
import { useT } from '@/i18n';
import { stagger } from '@/theme/motion';
import { color, font, media, themedStyles } from '@/theme/tokens';

type Props = { videos: FeedVideo[]; loading?: boolean; onOpen: (v: FeedVideo) => void; baseIndex?: number };

/**
 * Three-up poster grid. Tiles land first, then their view counts tick up.
 * Give it a new `key` when the filter changes and the cascade replays.
 */
export function TrendingGrid({ videos, loading, onOpen, baseIndex = 0 }: Props) {
  const { t } = useT();
  if (loading) {
    return (
      <View style={styles.grid}>
        {[0, 1, 2].map((i) => (
          <Shimmer key={i} index={i} />
        ))}
      </View>
    );
  }

  if (videos.length === 0) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.empty}>
        <Text style={styles.emptyText}>{t('discover.empty')}</Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.grid}>
      {videos.map((v, i) => (
        <View key={v.id} style={styles.cell}>
          <Enter index={baseIndex + i} rise={22}>
            <PressScale onPress={() => onOpen(v)} accessibilityRole="button" accessibilityLabel={v.caption} style={styles.tile}>
              <Image source={v.thumb} cachePolicy="memory-disk" recyclingKey={v.id} style={styles.fill} contentFit="cover" />
              <View pointerEvents="none" style={styles.scrim} />
              <View style={styles.views}>
                <Icon name="play" size={10} color={media.text} />
                <CountUp value={v.views} format={formatCount} delay={stagger(baseIndex + i) + 380} style={styles.viewsText} />
              </View>
            </PressScale>
          </Enter>
        </View>
      ))}
    </View>
  );
}

/** Placeholder tile breathing while the feed loads; staggered so the row ripples. */
function Shimmer({ index }: { index: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!reduce) p.value = withDelay(index * 140, withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [index, reduce, p]);
  const anim = useAnimatedStyle(() => ({ opacity: 0.45 + 0.4 * p.value }));
  return (
    <Animated.View style={[styles.cell, styles.tile, anim]}>
      <View />
    </Animated.View>
  );
}

const styles = themedStyles(() => ({
  // Explicit size: react-native-web lays images out at natural size under absoluteFill alone.
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  grid: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, maxWidth: '33.333%' },
  tile: { height: 172, borderRadius: 16, overflow: 'hidden', backgroundColor: color.surface1 },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
    experimental_backgroundImage: 'linear-gradient(0deg, rgba(10,10,15,0.7), rgba(10,10,15,0))',
  },
  views: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewsText: { color: media.text, fontFamily: font.mono, fontSize: 12 },
  empty: { height: 120, borderRadius: 16, borderWidth: 1, borderColor: color.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: color.text3, fontFamily: font.medium, fontSize: 14 },
}));
