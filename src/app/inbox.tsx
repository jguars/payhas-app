import { router, useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
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

import { Icon, IconName } from '@/components/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusScrim } from '@/components/StatusScrim';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { IconCircle } from '@/components/ui/IconCircle';
import { FeedVideo } from '@/features/feed/data';
import { useFeed } from '@/features/feed/useFeed';
import { translateInbox } from '@/features/inbox/translateInbox';
import { InboxItem, useLibrary } from '@/features/library/LibraryProvider';
import { useT, type T, type TKey } from '@/i18n';
import { fx } from '@/lib/feedback';
import { spring, stagger } from '@/theme/motion';
import { color, font, lane, pageFill, size, space, themedStyles } from '@/theme/tokens';

/** How long new items keep their dots on screen before they're marked read. */
const READ_AFTER_MS = 1400;

type CatId = 'new' | 'family' | 'payhas';
type Cat = { id: CatId; kinds: string[]; icon: IconName; tint: string; label: TKey };

/** The category rows at the top (after TikTok's inbox): each filters the list to its kinds. */
const CATS: Cat[] = [
  { id: 'new', kinds: ['new_video'], icon: 'play', tint: color.ember, label: 'inbox.catNew' },
  { id: 'family', kinds: ['family', 'shared'], icon: 'shield', tint: lane.kids.color, label: 'inbox.catFamily' },
  { id: 'payhas', kinds: ['welcome', 'creator'], icon: 'sparkle', tint: lane.adult.color, label: 'inbox.catPayhas' },
];

const catOf = (kind: string) => CATS.find((c) => c.kinds.includes(kind));

const ICONS: Record<string, IconName> = { new_video: 'play', shared: 'send', family: 'shield', welcome: 'sparkle', creator: 'star' };

export default function InboxScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const { inbox, refreshInbox, markInboxRead } = useLibrary();
  const { videos } = useFeed();
  const { t } = useT();
  const [seen, setSeen] = useState(false);
  const [cat, setCat] = useState<CatId | null>(null);
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

  const counts = useMemo(() => {
    const m = new Map<CatId, { total: number; unread: number }>();
    for (const c of CATS) {
      const items = inbox.filter((i) => c.kinds.includes(i.kind));
      m.set(c.id, { total: items.length, unread: items.filter((i) => !i.read_at).length });
    }
    return m;
  }, [inbox]);

  // A filter whose category emptied out (after a refresh) falls back to everything.
  const active = cat && (counts.get(cat)?.total ?? 0) > 0 ? cat : null;
  const { fresh, earlier } = useMemo(() => {
    const kinds = active ? CATS.find((c) => c.id === active)!.kinds : null;
    const shown = kinds ? inbox.filter((i) => kinds.includes(i.kind)) : inbox;
    return { fresh: shown.filter((i) => !i.read_at), earlier: shown.filter((i) => i.read_at) };
  }, [inbox, active]);

  const videoFor = (item: InboxItem): FeedVideo | undefined => videos.find((v) => v.id === item.video_id);
  const open = (item: InboxItem) => {
    if (item.video_id) router.navigate({ pathname: '/', params: { v: item.video_id } });
  };

  const cats = CATS.filter((c) => (counts.get(c.id)?.total ?? 0) > 0);

  let n = 1 + cats.length; // running Enter index so sections cascade as one list
  const section = (title: string, items: InboxItem[], unread: boolean) =>
    items.length > 0 && (
      <View style={{ gap: space.sm }}>
        <Enter index={n++}>
          <Text style={styles.h2}>{title}</Text>
        </Enter>
        {items.map((item) => (
          <Enter key={item.id} index={n++}>
            <Card item={item} video={videoFor(item)} unread={unread} fading={seen} order={n} onPress={() => open(item)} />
          </Enter>
        ))}
      </View>
    );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + barSpace }]} showsVerticalScrollIndicator={false}>
        {/* Inbox lives inside Me now (owner's Me option D): a page with a back button, not a tab. */}
        <Enter index={0}>
          <PageHeader title={t('inbox.title')} back />
        </Enter>
        {inbox.length === 0 ? (
          <Empty />
        ) : (
          <>
            <View>
              {cats.map((c, i) => (
                <Enter key={c.id} index={1 + i}>
                  <CatRow
                    cat={c}
                    total={counts.get(c.id)?.total ?? 0}
                    unread={counts.get(c.id)?.unread ?? 0}
                    on={active === c.id}
                    onPress={() => {
                      fx.tab();
                      setCat(active === c.id ? null : c.id);
                    }}
                  />
                </Enter>
              ))}
            </View>
            <View key={active ?? 'all'} style={{ gap: space.xl }}>
              {section(t('inbox.new'), fresh, true)}
              {section(t('inbox.earlier'), earlier, false)}
            </View>
          </>
        )}
      </ScrollView>
      <StatusScrim />
    </View>
  );
}

/** A category row: colour circle, name, count and a chevron that turns down while it filters. */
function CatRow({ cat, total, unread, on, onPress }: { cat: Cat; total: number; unread: number; on: boolean; onPress: () => void }) {
  const { t } = useT();
  const turn = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    turn.value = withSpring(on ? 1 : 0, spring.snappy);
  }, [on, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${90 * turn.value}deg` }] }));
  const wash = useAnimatedStyle(() => ({ opacity: Math.min(1, turn.value) }));
  const label = t(cat.label);

  return (
    <PressScale
      onPress={onPress}
      pressedScale={0.98}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label}, ${total}`}
      style={styles.catRow}
    >
      <Animated.View pointerEvents="none" style={[styles.catWash, wash]} />
      <IconCircle icon={cat.icon} tint={cat.tint} size={48} />
      <Text style={styles.catLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.count, unread > 0 && { backgroundColor: color.ember }]}>
        <Text style={[styles.countText, unread > 0 && { color: color.ink }]}>{unread > 0 ? unread : total}</Text>
      </View>
      <Animated.View style={chevron}>
        <Icon name="chevron" size={16} color={color.text3} strokeWidth={2.6} />
      </Animated.View>
    </PressScale>
  );
}

/** An activity card on a warm wash of its category's colour, the video's poster on the right. */
function Card({
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
  const tint = catOf(item.kind)?.tint ?? color.ember;
  return (
    <PressScale
      onPress={onPress}
      disabled={!tappable}
      pressedScale={0.98}
      accessibilityRole={tappable ? 'button' : 'text'}
      style={[styles.card, { backgroundColor: tint + '1F' }]}
    >
      <IconCircle icon={ICONS[item.kind] ?? 'sparkle'} tint={tint} size={36} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {title}
        </Text>
        {!!body && (
          <Text style={styles.cardText} numberOfLines={2}>
            {body}
          </Text>
        )}
        <View style={styles.meta}>
          <Text style={styles.time}>{ago(item.created_at, t)}</Text>
          {unread && <UnreadDot fading={fading} delay={stagger(order, 70)} />}
        </View>
        {tappable && (
          <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={({ pressed }) => [styles.watch, pressed && { opacity: 0.8 }]}>
            <Icon name="play" size={11} color={color.ink} />
            <Text style={styles.watchText}>{t('inbox.watch')}</Text>
          </Pressable>
        )}
      </View>
      {video?.thumb != null && <Image source={video.thumb} cachePolicy="memory-disk" style={styles.thumb} contentFit="cover" />}
    </PressScale>
  );
}

/** Pulses once on arrival; when the screen marks things read it shrinks away, card by card. */
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

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.xl },
  title: { color: color.text, fontFamily: font.display, fontSize: size.display, letterSpacing: -1 },
  h2: { color: color.text2, fontFamily: font.semibold, fontSize: size.small, letterSpacing: 0.4, textTransform: 'uppercase' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm, paddingHorizontal: space.sm, marginHorizontal: -space.sm, borderRadius: 18 },
  catWash: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 18, backgroundColor: color.surface1 },
  catLabel: { flex: 1, color: color.text, fontFamily: font.bold, fontSize: size.body },
  count: { minWidth: 26, height: 22, paddingHorizontal: 7, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface2 },
  countText: { color: color.text2, fontFamily: font.mono, fontSize: size.caption },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg, borderRadius: 20 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { color: color.text, fontFamily: font.bold, fontSize: size.body, lineHeight: 20 },
  cardText: { color: color.text2, fontFamily: font.medium, fontSize: size.small, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  time: { color: color.text3, fontFamily: font.mono, fontSize: size.caption },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.ember },
  watch: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 14, marginTop: 6, borderRadius: 999, backgroundColor: color.ember },
  watchText: { color: color.ink, fontFamily: font.bold, fontSize: size.small },
  thumb: { width: 64, height: 86, borderRadius: 12, backgroundColor: color.surface2 },
  empty: { alignItems: 'center', gap: space.md, paddingTop: 120 },
  emptyText: { color: color.text3, fontFamily: font.medium, fontSize: size.body },
}));
