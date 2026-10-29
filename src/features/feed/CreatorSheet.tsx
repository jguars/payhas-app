import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { useT } from '@/i18n';
import { color, font, radius, space } from '@/theme/tokens';

import { FeedVideo, formatCount } from './data';
import { FollowButton } from './FollowButton';
import { useCreators } from './useCreators';

type Props = { name: string | null; videos: FeedVideo[]; onClose: () => void; onOpenVideo: (id: string) => void };

/** Tap an avatar → who made this, follow them, and what else they've made for your lane. */
export function CreatorSheet({ name, videos, onClose, onOpenVideo }: Props) {
  const { creators } = useCreators();
  const { t } = useT();
  const creator = creators.find((c) => c.creator_name === name);
  const theirs = videos.filter((v) => v.creator.name === name);

  return (
    <BottomSheet open={!!name} onClose={onClose}>
      {name && (
        <View style={styles.body}>
          <View style={styles.head}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{name[0]}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {creator?.verified && <Icon name="verified" size={16} color={color.verified} />}
              </View>
              <Text style={styles.meta}>
                {t('feed.followers', { count: creator?.follower_count ?? 0, n: formatCount(creator?.follower_count ?? 0) })} · {t('feed.videos', { count: creator?.video_count ?? theirs.length })}
              </Text>
            </View>
          </View>
          <FollowButton creator={name} />
          <View style={styles.grid}>
            {theirs.map((v, i) => (
              <Animated.View key={v.id} entering={FadeIn.delay(80 + i * 60).duration(220)} style={styles.cell}>
                <PressScale onPress={() => onOpenVideo(v.id)} accessibilityRole="button" accessibilityLabel={v.caption} style={styles.tile}>
                  <Image source={v.thumb} cachePolicy="memory-disk" recyclingKey={v.id} style={styles.fill} contentFit="cover" />
                  <View style={styles.views}>
                    <Icon name="play" size={10} />
                    <Text style={styles.viewsText}>{formatCount(v.views)}</Text>
                  </View>
                </PressScale>
              </Animated.View>
            ))}
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl, gap: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: color.surface2, borderWidth: 2, borderColor: color.text, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: color.text, fontFamily: font.display, fontSize: 26 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: color.text, fontFamily: font.title, fontSize: 22, flexShrink: 1 },
  meta: { color: color.text2, fontFamily: font.medium, fontSize: 13 },
  grid: { flexDirection: 'row', gap: 8 },
  cell: { width: '31.5%' },
  tile: { height: 150, borderRadius: radius.chip + 2, overflow: 'hidden', backgroundColor: color.surface2 },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  views: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewsText: { color: color.text, fontFamily: font.mono, fontSize: 12 },
});
