import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { useLibrary } from '@/features/library/LibraryProvider';
import { T, topicLabel, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { alpha, border, color, control, font, iconSize, iconStroke, radius, size, space, themedStyles, type } from '@/theme/tokens';

import { ChannelAvatar } from './ChannelAvatar';
import type { ChannelHub } from './useChannels';

export const openChannel = (name: string) => router.push({ pathname: '/channel', params: { name } });

/** What a channel is about, in the app's language: "75 videos · Nature, Science". */
function about(t: T, c: ChannelHub, topics = 2) {
  const labels = c.topics.slice(0, topics).map((s) => topicLabel(t, s, s));
  return [t('discover.channelVideos', { count: c.count }), labels.join(', ')].filter(Boolean).join(' · ');
}

/**
 * Discover's Channels tab: every channel as one row in a single list — its
 * face, name and what it's about, and a follow button at the end (after the
 * Spotify / Apple Podcasts lists). The row opens the channel.
 */
export function ChannelHubs({ channels, baseIndex = 0 }: { channels: ChannelHub[]; baseIndex?: number }) {
  if (channels.length === 0) return null;
  return (
    <Enter index={baseIndex}>
      <View style={styles.group}>
        {channels.map((c, i) => (
          <ChannelRow key={c.name} channel={c} first={i === 0} />
        ))}
      </View>
    </Enter>
  );
}

function ChannelRow({ channel: c, first }: { channel: ChannelHub; first: boolean }) {
  const { t } = useT();
  return (
    <View style={[styles.row, !first && styles.divider]}>
      <Pressable
        onPress={() => {
          fx.tap();
          openChannel(c.name);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${c.name}. ${about(t, c)}`}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        <ChannelAvatar look={c.look} size={control.md - space.xs} />
        <View style={styles.rowText}>
          <Text style={styles.name} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {about(t, c)}
          </Text>
        </View>
      </Pressable>
      <FollowButton name={c.name} />
    </View>
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
    <Pressable onPress={press} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} style={[styles.followDot, on && styles.followDotOn]}>
      <Icon name={on ? 'check' : 'plus'} size={iconSize.md} color={color.text} strokeWidth={iconStroke(iconSize.md)} />
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  group: { backgroundColor: color.surface1, borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: space.md },
  divider: { borderTopWidth: border.hairline, borderTopColor: color.line },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingLeft: space.md, minHeight: control.lg + space.md },
  pressed: { backgroundColor: color.surface2 },
  rowText: { flex: 1, gap: space.xs / 2 },
  name: { color: color.text, fontFamily: font.bold, ...type.body },
  meta: { color: color.text2, fontFamily: font.medium, ...type.small },
  followBig: { minHeight: control.md, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  followBigOn: { backgroundColor: alpha(color.text, 0.12) },
  followBigText: { color: color.ink, fontFamily: font.bold, fontSize: size.body },
  followDot: { width: control.sm, height: control.sm, borderRadius: radius.pill, borderWidth: border.strong, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  followDotOn: { borderColor: 'transparent', backgroundColor: color.surface2 },
}));
