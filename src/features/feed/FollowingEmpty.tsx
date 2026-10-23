import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { useT } from '@/i18n';
import { color, font, radius, space } from '@/theme/tokens';

import { FeedVideo, formatCount } from './data';
import { FollowButton } from './FollowButton';
import { useCreators } from './useCreators';

const CARD_W = 220;

/** Following with nobody followed yet: suggest creators from this lane instead of an empty screen. */
export function FollowingEmpty({ videos, top }: { videos: FeedVideo[]; top: number }) {
  const { creators } = useCreators();
  const { t } = useT();
  const { width } = useWindowDimensions();
  const thumbFor = (id: string) => videos.find((v) => v.id === id)?.thumb;

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <Enter index={0}>
        <Text style={styles.title}>{t('feed.empty.title')}</Text>
      </Enter>
      <Enter index={1}>
        <Text style={styles.sub}>{t('feed.empty.sub')}</Text>
      </Enter>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={CARD_W + space.md} decelerationRate="fast" contentContainerStyle={[styles.row, { paddingHorizontal: Math.max(space.lg, (width - CARD_W) / 2) }]}>
        {creators.map((c, i) => {
          const thumb = thumbFor(c.latest_video_id);
          return (
            <Enter key={c.creator_name} index={2 + i} rise={24} style={styles.card}>
              {thumb != null && <Image source={thumb} style={styles.poster} resizeMode="cover" />}
              <View style={styles.scrim} />
              <View style={styles.cardBody}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>{c.creator_name[0]}</Text>
                </View>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {c.creator_name}
                  </Text>
                  {c.verified && <Icon name="verified" size={14} color={color.verified} />}
                </View>
                <Text style={styles.meta}>
                  {t('feed.videos', { count: c.video_count })} · {t('feed.followers', { count: c.follower_count, n: formatCount(c.follower_count) })}
                </Text>
                <FollowButton creator={c.creator_name} />
              </View>
            </Enter>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink, justifyContent: 'center', gap: space.sm },
  title: { color: color.text, fontFamily: font.display, fontSize: 26, textAlign: 'center', letterSpacing: -0.5 },
  sub: { color: color.text2, fontFamily: font.medium, fontSize: 15, textAlign: 'center', marginBottom: space.xl },
  row: { gap: space.md },
  card: { width: CARD_W, height: 330, borderRadius: radius.card + 4, overflow: 'hidden', backgroundColor: color.surface1 },
  poster: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '75%', experimental_backgroundImage: 'linear-gradient(0deg, rgba(10,10,15,0.95) 35%, rgba(10,10,15,0))' },
  cardBody: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, alignItems: 'center', gap: 6 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.surface2, borderWidth: 2, borderColor: color.text, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarLetter: { color: color.text, fontFamily: font.display, fontSize: 22 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: color.text, fontFamily: font.bold, fontSize: 16, flexShrink: 1 },
  meta: { color: color.text2, fontFamily: font.medium, fontSize: 12, marginBottom: space.sm },
});
