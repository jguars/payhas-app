import { router, useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';

import { Icon } from '@/components/Icon';
import { StatusScrim } from '@/components/StatusScrim';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { FeedVideo, MediaSource } from '@/features/feed/data';
import { useFeed } from '@/features/feed/useFeed';
import { translateInbox } from '@/features/inbox/translateInbox';
import { InboxItem, useLibrary } from '@/features/library/LibraryProvider';
import { useT, type T } from '@/i18n';
import { spring, stagger } from '@/theme/motion';
import { color, font, space } from '@/theme/tokens';

/** How long new items keep their dots on screen before they're marked read. */
const READ_AFTER_MS = 1400;

export default function InboxScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const { inbox, refreshInbox, markInboxRead } = useLibrary();
  const { videos } = useFeed();
  const { t } = useT();
  const [seen, setSeen] = useState(false);
  const wasFocused = useRef(false);

  // On arrival: refresh, show the dots, then mark read and let them fade.
  // On leaving: refresh so the tab badge clears.
  useEffect(() => {
    if (focused) {
      setSeen(false);
      refreshInbox();
      const timer = setTimeout(() => {
        setSeen(true);
        markInboxRead();
      }, READ_AFTER_MS);
      wasFocused.current = true;
      return () => clearTimeout(timer);
    }
    if (wasFocused.current) refreshInbox();
  }, [focused, refreshInbox, markInboxRead]);

  const { fresh, earlier } = useMemo(
    () => ({ fresh: inbox.filter((i) => !i.read_at), earlier: inbox.filter((i) => i.read_at) }),
    [inbox],
  );

  const videoFor = (item: InboxItem): FeedVideo | undefined => videos.find((v) => v.id === item.video_id);
  const open = (item: InboxItem) => {
    if (item.video_id) router.navigate({ pathname: '/', params: { v: item.video_id } });
  };

  let n = 1; // running Enter index so sections cascade as one list
  const section = (title: string, items: InboxItem[], unread: boolean) =>
    items.length > 0 && (
      <View style={{ gap: space.sm }}>
        <Enter index={n++}>
          <Text style={styles.h2}>{title}</Text>
        </Enter>
        {items.map((item) => (
          <Enter key={item.id} index={n++}>
            <Row item={item} video={videoFor(item)} unread={unread} fading={seen} order={n} onPress={() => open(item)} />
          </Enter>
        ))}
      </View>
    );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: barSpace }]} showsVerticalScrollIndicator={false}>
        <Enter index={0}>
          <Text style={styles.title} accessibilityRole="header">
            {t('inbox.title')}
          </Text>
        </Enter>
        {inbox.length === 0 ? (
          <Empty />
        ) : (
          <>
            {section(t('inbox.new'), fresh, true)}
            {section(t('inbox.earlier'), earlier, false)}
          </>
        )}
      </ScrollView>
      <StatusScrim />
    </View>
  );
}

function Row({
  item,
  video,
  unread,
  fading,
  order,
  onPress,
}: {
  item: InboxItem;
  video?: FeedVideo;
  unread: boolean;
  fading: boolean;
  order: number;
  onPress: () => void;
}) {
  const { t, lang } = useT();
  const tappable = !!item.video_id;
  const { title, body } = translateInbox(item, t, lang, video?.caption);
  return (
    <PressScale onPress={onPress} disabled={!tappable} pressedScale={0.98} accessibilityRole={tappable ? 'button' : 'text'} style={styles.row}>
      <Badge item={item} thumb={video?.thumb} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!body && (
          <Text style={styles.rowBody} numberOfLines={2}>
            {body}
          </Text>
        )}
      </View>
      <View style={styles.rowEnd}>
        <Text style={styles.time}>{ago(item.created_at, t)}</Text>
        {unread && <UnreadDot fading={fading} delay={stagger(order, 70)} />}
      </View>
    </PressScale>
  );
}

function Badge({ item, thumb }: { item: InboxItem; thumb?: MediaSource }) {
  if ((item.kind === 'new_video' || item.kind === 'shared') && thumb != null) {
    return (
      <View>
        <Image source={thumb} style={styles.thumb} resizeMode="cover" />
        {item.kind === 'shared' && (
          <View style={styles.sentBadge}>
            <Icon name="send" size={11} color={color.ink} strokeWidth={2.6} />
          </View>
        )}
      </View>
    );
  }
  const family = item.kind === 'family';
  return (
    <View style={[styles.badge, { backgroundColor: family ? 'rgba(79,227,176,0.14)' : 'rgba(255,90,60,0.14)' }]}>
      <Icon name={family ? 'shield' : 'sparkle'} size={20} color={family ? '#4FE3B0' : color.ember} filled={!family} />
    </View>
  );
}

/** Pulses once on arrival; when the screen marks things read it shrinks away, row by row. */
function UnreadDot({ fading, delay }: { fading: boolean; delay: number }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    s.value = withDelay(delay + 250, withSequence(withSpring(1.5, spring.bouncy), withSpring(1, spring.smooth)));
  }, [delay, reduce, s]);
  useEffect(() => {
    if (fading) s.value = withDelay(delay, withTiming(0, { duration: 260, easing: Easing.in(Easing.back(2)) }));
  }, [fading, delay, s]);
  const anim = useAnimatedStyle(() => ({ opacity: Math.min(1, s.value), transform: [{ scale: s.value }] }));
  return <Animated.View style={[styles.dot, anim]} />;
}

/** Nothing new: an inbox tray bobbing gently. */
function Empty() {
  const reduce = useReducedMotion();
  const { t } = useT();
  const bob = useSharedValue(0);
  useEffect(() => {
    if (!reduce) bob.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, bob]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: -5 + 10 * bob.value }] }));
  return (
    <Enter index={1} style={styles.empty}>
      <Animated.View style={anim}>
        <Icon name="inbox" size={44} color={color.text3} strokeWidth={1.6} />
      </Animated.View>
      <Text style={styles.emptyText}>{t('inbox.empty')}</Text>
    </Enter>
  );
}

function ago(iso: string, t: T) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return t('inbox.now');
  if (s < 3600) return t('inbox.agoMinutes', { n: Math.floor(s / 60) });
  if (s < 86400) return t('inbox.agoHours', { n: Math.floor(s / 3600) });
  return t('inbox.agoDays', { n: Math.floor(s / 86400) });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.xl },
  title: { color: color.text, fontFamily: font.display, fontSize: 30, letterSpacing: -0.9 },
  h2: { color: color.text2, fontFamily: font.semibold, fontSize: 13, letterSpacing: 0.4, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 18, backgroundColor: color.surface1 },
  thumb: { width: 48, height: 60, borderRadius: 10, backgroundColor: color.surface2 },
  sentBadge: { position: 'absolute', right: -5, bottom: -5, width: 22, height: 22, borderRadius: 11, backgroundColor: color.ember, borderWidth: 2, borderColor: color.surface1, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: color.text, fontFamily: font.bold, fontSize: 15 },
  rowBody: { color: color.text2, fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  rowEnd: { alignItems: 'flex-end', gap: 8, alignSelf: 'stretch', paddingVertical: 2 },
  time: { color: color.text3, fontFamily: font.mono, fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.ember },
  empty: { alignItems: 'center', gap: space.md, paddingTop: 120 },
  emptyText: { color: color.text3, fontFamily: font.medium, fontSize: 15 },
});
