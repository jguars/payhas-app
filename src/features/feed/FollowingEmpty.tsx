import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { useT } from '@/i18n';
import { border, color, control, font, iconSize, layout, media, radius, space, themedStyles, type } from '@/theme/tokens';

import { FeedVideo, formatCount } from './data';
import { FollowButton } from './FollowButton';
import { useCreators } from './useCreators';

/** Two creator cards per row (approved 2026-10-31, design/screens/following-mock.png). */
const COLUMNS = 2;

/**
 * Following with nobody followed yet: suggest creators from this lane instead
 * of an empty screen. A grid that scrolls up and down — a sideways row of
 * cards inside the sideways Following / For you pager swallowed the swipe to
 * For you.
 */
export function FollowingEmpty({ videos, top }: { videos: FeedVideo[]; top: number }) {
  const { creators } = useCreators();
  const { t } = useT();
  const { width } = useWindowDimensions();
  const thumbFor = (id: string) => videos.find((v) => v.id === id)?.thumb;
  const cardW = (width - layout.gutter * 2 - space.md * (COLUMNS - 1)) / COLUMNS;

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: top }]} showsVerticalScrollIndicator={false}>
      <Enter index={0}>
        <Text style={styles.title}>{t('feed.empty.title')}</Text>
      </Enter>
      <Enter index={1}>
        <Text style={styles.sub}>{t('feed.empty.sub')}</Text>
      </Enter>
      <View style={styles.grid}>
        {creators.map((c, i) => {
          const thumb = thumbFor(c.latest_video_id);
          return (
            <Enter key={c.creator_name} index={2 + i} rise={16} style={[styles.card, { width: cardW }]}>
              {thumb != null && <Image source={thumb} cachePolicy="memory-disk" style={styles.poster} contentFit="cover" aria-hidden accessible={false} />}
              <View style={styles.scrim} />
              <View style={styles.cardBody}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>{c.creator_name[0]}</Text>
                </View>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {c.creator_name}
                  </Text>
                  {c.verified && <Icon name="verified" size={iconSize.sm} color={color.verified} />}
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  {t('feed.videos', { count: c.video_count })} · {t('feed.followers', { count: c.follower_count, n: formatCount(c.follower_count) })}
                </Text>
                <FollowButton creator={c.creator_name} size="sm" />
              </View>
            </Enter>
          );
        })}
      </View>
    </ScrollView>
  );
}

const AVATAR = control.sm;

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: color.ink },
  content: { paddingHorizontal: layout.gutter, paddingBottom: space.xxl, gap: space.xs },
  title: { color: media.text, fontFamily: font.display, ...type.heading },
  sub: { color: media.text2, fontFamily: font.medium, ...type.body, marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden', backgroundColor: media.surface1 },
  poster: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '80%', experimental_backgroundImage: 'linear-gradient(0deg, rgba(10,10,15,0.96) 40%, rgba(10,10,15,0))' },
  cardBody: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.md, alignItems: 'center', gap: space.xs },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: radius.pill, backgroundColor: media.surface2, borderWidth: border.strong, borderColor: media.text, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: media.text, fontFamily: font.display, ...type.lead },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, maxWidth: '100%' },
  name: { color: media.text, fontFamily: font.bold, ...type.small, flexShrink: 1 },
  meta: { color: media.text2, fontFamily: font.medium, ...type.caption, marginBottom: space.xs },
}));
