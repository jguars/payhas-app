import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { useLibrary } from '@/features/library/LibraryProvider';
import { T, topicLabel, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { alpha, color, font, radius, space, themedStyles } from '@/theme/tokens';

import { ChannelAvatar } from './ChannelAvatar';
import type { ChannelHub } from './useChannels';

const GAP = space.md;

export const openChannel = (name: string) => router.push({ pathname: '/channel', params: { name } });

/** What a channel is about, in the app's language: "75 videos · Nature, Science". */
function about(t: T, c: ChannelHub, topics = 2) {
  const labels = c.topics.slice(0, topics).map((s) => topicLabel(t, s, s));
  return [t('discover.channelVideos', { count: c.count }), labels.join(', ')].filter(Boolean).join(' · ');
}

/**
 * Discover's Channels tab (after Hulu's hubs): the busiest channel as a big
 * featured card with its newest posters, then every channel as a tinted tile.
 */
export function ChannelHubs({ channels, baseIndex = 0 }: { channels: ChannelHub[]; baseIndex?: number }) {
  const { t } = useT();
  const { width } = useWindowDimensions();
  if (channels.length === 0) return null;
  const [featured, ...rest] = channels;
  const tileW = (Math.min(width, 560) - space.lg * 2 - GAP) / 2;

  return (
    <View style={{ gap: space.xl }}>
      <Enter index={baseIndex} rise={24}>
        <Featured channel={featured} />
      </Enter>
      {rest.length > 0 && (
        <View style={{ gap: space.md }}>
          <Enter index={baseIndex + 1} style={styles.head}>
            <Text style={styles.h2} accessibilityRole="header">
              {t('discover.allChannels')}
            </Text>
            <Text style={styles.count}>{channels.length}</Text>
          </Enter>
          <View style={styles.grid}>
            {rest.map((c, i) => (
              <Enter key={c.name} index={baseIndex + 2 + i} style={{ width: tileW }}>
                <ChannelTile channel={c} />
              </Enter>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Featured({ channel: c }: { channel: ChannelHub }) {
  const { t } = useT();
  return (
    <PressScale onPress={() => openChannel(c.name)} pressedScale={0.98} accessibilityRole="button" accessibilityLabel={`${c.name}. ${about(t, c, 3)}`} style={[styles.featured, { backgroundColor: alpha(c.look.tint, 0.14), borderColor: alpha(c.look.tint, 0.35) }]}>
      <View style={styles.featuredHead}>
        <ChannelAvatar look={c.look} size={72} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.featuredName} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={styles.meta} numberOfLines={2}>
            {about(t, c, 3)}
          </Text>
        </View>
        <FollowButton name={c.name} big />
      </View>
      <View style={styles.posters}>
        {c.posters.map((p) => (
          <Image key={p.id} source={p.thumb} cachePolicy="memory-disk" recyclingKey={p.id} style={styles.poster} contentFit="cover" />
        ))}
      </View>
    </PressScale>
  );
}

function ChannelTile({ channel: c }: { channel: ChannelHub }) {
  const { t } = useT();
  return (
    <PressScale onPress={() => openChannel(c.name)} accessibilityRole="button" accessibilityLabel={`${c.name}. ${about(t, c)}`} style={[styles.tile, { backgroundColor: alpha(c.look.tint, 0.12) }]}>
      <View style={styles.tileTop}>
        <ChannelAvatar look={c.look} size={56} />
        <FollowButton name={c.name} />
      </View>
      <Text style={styles.tileName} numberOfLines={2}>
        {c.name}
      </Text>
      <Text style={styles.meta} numberOfLines={2}>
        {about(t, c)}
      </Text>
    </PressScale>
  );
}

/** Follow toggle; the big one says it, the small one is a + / check disc. */
export function FollowButton({ name, big }: { name: string; big?: boolean }) {
  const { t } = useT();
  const { following, toggleFollow } = useLibrary();
  const on = following.has(name);
  const press = () => {
    if (on) fx.tap();
    else fx.follow();
    toggleFollow(name);
  };
  const label = on ? t('feed.unfollowName', { name }) : t('feed.followName', { name });
  if (big) {
    return (
      <PressScale onPress={press} pressedScale={0.92} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} style={[styles.followBig, on && styles.followBigOn]}>
        <Text style={[styles.followBigText, on && { color: color.text }]}>{on ? t('feed.following') : t('feed.follow')}</Text>
      </PressScale>
    );
  }
  return (
    <Pressable onPress={press} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} style={[styles.followDot, on && styles.followDotOn]}>
      <Icon name={on ? 'check' : 'plus'} size={16} color={on ? color.onInverse : color.text} strokeWidth={2.6} />
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  h2: { color: color.text, fontFamily: font.title, fontSize: 20, letterSpacing: -0.3 },
  count: { color: color.text3, fontFamily: font.mono, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  featured: { borderRadius: 26, borderWidth: 1.5, overflow: 'hidden' },
  featuredHead: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, paddingBottom: 14 },
  featuredName: { color: color.text, fontFamily: font.display, fontSize: 24, letterSpacing: -0.6 },
  meta: { color: color.text2, fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  posters: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
  poster: { flex: 1, height: 150, borderRadius: 14, backgroundColor: color.surface2 },
  tile: { borderRadius: radius.card, padding: 16, gap: 10, minHeight: 156 },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  tileName: { color: color.text, fontFamily: font.title, fontSize: 17, letterSpacing: -0.3 },
  followBig: { minHeight: 44, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  followBigOn: { backgroundColor: alpha(color.text, 0.12) },
  followBigText: { color: color.ink, fontFamily: font.bold, fontSize: 15 },
  followDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: alpha(color.text, 0.12), alignItems: 'center', justifyContent: 'center' },
  followDotOn: { backgroundColor: color.inverse },
}));
