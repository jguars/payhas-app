import { router } from 'expo-router';
import { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatCount } from '@/features/feed/data';
import { FollowButton } from '@/features/feed/FollowButton';
import { useCreators } from '@/features/feed/useCreators';
import { useLibrary } from '@/features/library/LibraryProvider';
import { useT } from '@/i18n';
import { useInsets } from '@/lib/useInsets';
import { color, font, pageFill, space, themedStyles } from '@/theme/tokens';

/**
 * Creators this profile follows. Unfollowing keeps the row (with "Follow")
 * until you leave, so a mis-tap is one tap to undo — the list doesn't jump.
 */
export default function FollowingScreen() {
  const { creators, loading } = useCreators();
  const { following } = useLibrary();
  const { bottom } = useInsets();
  const { t } = useT();
  // Everyone followed at any point during this visit keeps their row.
  const seen = useRef(new Set<string>());
  for (const c of creators) if (c.following || following.has(c.creator_name)) seen.current.add(c.creator_name);
  const rows = creators.filter((c) => seen.current.has(c.creator_name));

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('feed.following.title')} />
      {!loading && rows.length === 0 ? (
        <Enter index={0} style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('feed.following.empty')}</Text>
          <PressScale onPress={() => router.navigate('/')} accessibilityRole="button" style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>{t('feed.following.find')}</Text>
          </PressScale>
        </Enter>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: bottom + space.xl, gap: space.sm }}>
          {rows.map((c, i) => (
            <Enter key={c.creator_name} index={i} style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>{c.creator_name[0]}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {c.creator_name}
                  </Text>
                  {c.verified && <Icon name="verified" size={14} color={color.verified} />}
                </View>
                <Text style={styles.meta}>
                  {t('feed.followers', { count: c.follower_count, n: formatCount(c.follower_count) })} · {t('feed.videos', { count: c.video_count })}
                </Text>
              </View>
              <FollowButton creator={c.creator_name} size="sm" />
            </Enter>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 18, backgroundColor: color.surface1 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.surface2, borderWidth: 2, borderColor: color.text, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: color.text, fontFamily: font.display, fontSize: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: color.text, fontFamily: font.bold, fontSize: 15, flexShrink: 1 },
  meta: { color: color.text2, fontFamily: font.medium, fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingBottom: 80 },
  emptyTitle: { color: color.text, fontFamily: font.title, fontSize: 20 },
  emptyButton: { minHeight: 48, paddingHorizontal: space.xl, borderRadius: 999, backgroundColor: color.ember, justifyContent: 'center' },
  emptyButtonText: { color: color.ink, fontFamily: font.bold, fontSize: 15 },
}));
