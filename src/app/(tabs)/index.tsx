import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, LayoutChangeEvent, Pressable, Text, View, ViewToken } from 'react-native';
import Animated, { interpolate, SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { LaneBadge } from '@/components/LaneBadge';
import { useFamily } from '@/features/family/FamilyProvider';
import { CreatorSheet } from '@/features/feed/CreatorSheet';
import { FeedVideo } from '@/features/feed/data';
import { FeedItem } from '@/features/feed/FeedItem';
import { FollowingEmpty } from '@/features/feed/FollowingEmpty';
import { LockedNext } from '@/features/feed/LockedNext';
import { takeOpened } from '@/features/feed/openVideo';
import { FeedMode, useFeed } from '@/features/feed/useFeed';
import { SheetMode, VideoSheet } from '@/features/feed/VideoSheet';
import { TimesUp } from '@/features/library/TimesUp';
import { roleKey, TKey, useT } from '@/i18n';
import { useScreenTime } from '@/features/library/useScreenTime';
import { useProfilePlan } from '@/features/plan/usePlan';
import { fx } from '@/lib/feedback';
import { useReportVideoUnderBar } from '@/lib/tabBarTone';
import { FEED_CHROME_BOTTOM, useInsets } from '@/lib/useInsets';
import { alpha, color, font, media, size, themedStyles } from '@/theme/tokens';

const UNDERLINE = 14;

const TABS: { mode: FeedMode; label: TKey }[] = [
  { mode: 'following', label: 'feed.tab.following' },
  { mode: 'forYou', label: 'feed.tab.forYou' },
];

const PAGES: FeedMode[] = ['following', 'forYou'];

export default function FeedScreen() {
  const insets = useInsets();
  const focused = useIsFocused();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const [mode, setMode] = useState<FeedMode>('forYou');
  // Each feed remembers which video it's on, so swiping between them resumes where you were.
  const [activeIndex, setActiveIndex] = useState<Record<FeedMode, number>>({ forYou: 0, following: 0 });
  const { active, leaveProfile } = useFamily();
  const forYou = useFeed('forYou');
  const followingFeed = useFeed('following');
  // Free plan: after today's 30 videos the feeds come back empty; check why when one runs dry,
  // and put a locked "next video" (Unlock with Plus) at the end.
  const { plan, reload: reloadPlan } = useProfilePlan();
  const capReached = plan?.videosLeft === 0;
  useEffect(() => {
    if (forYou.done || followingFeed.done) reloadPlan();
  }, [forYou.done, followingFeed.done, forYou.videos.length, reloadPlan]);
  const { lock } = useScreenTime();
  const pager = useRef<Animated.ScrollView>(null);
  const lists = { forYou: useRef<FlatList>(null), following: useRef<FlatList>(null) };
  const scrollX = useSharedValue(width);
  const { t } = useT();

  const [sheet, setSheet] = useState<{ video: FeedVideo; mode: SheetMode } | null>(null);
  const [creator, setCreator] = useState<string | null>(null);

  // FlatList wants stable viewability callbacks; setActiveIndex is stable, so these can be too.
  const pick = (m: FeedMode, items: ViewToken[]) => {
    const first = items.find((v) => v.isViewable);
    // No video on screen (e.g. the locked slot at the end on Free): nothing plays.
    const next = first?.index ?? -1;
    setActiveIndex((cur) => (cur[m] === next ? cur : { ...cur, [m]: next }));
  };
  const onViewableForYou = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => pick('forYou', viewableItems)).current;
  const onViewableFollowing = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => pick('following', viewableItems)).current;

  /** Slide the pager to a feed (tab tap, deep link, creator sheet). */
  const goTo = useCallback(
    (m: FeedMode, animated = true) => {
      setMode(m);
      if (width > 0) pager.current?.scrollTo({ x: PAGES.indexOf(m) * width, animated });
    },
    [width],
  );

  const jumpTo = useCallback(
    (id: string) => {
      const index = forYou.videos.findIndex((x) => x.id === id);
      if (index < 0 || height === 0) return false;
      lists.forYou.current?.scrollToOffset({ offset: index * height, animated: false });
      setActiveIndex((cur) => ({ ...cur, forYou: index }));
      return true;
    },
    [forYou.videos, height], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Discover, Inbox and Saved open a specific video with /?v=<id>: jump to it in For you.
  const { v: target } = useLocalSearchParams<{ v?: string }>();
  useEffect(() => {
    if (!target) return;
    if (mode !== 'forYou') return goTo('forYou', false);
    if (height === 0 || forYou.videos.length === 0) return;
    if (!jumpTo(target)) {
      // Not loaded yet (a channel's older video, say): slot it in; this effect runs again and jumps.
      const opened = takeOpened(target);
      if (opened) return forYou.insert(opened);
    }
    router.setParams({ v: undefined });
  }, [target, height, forYou.videos, mode, jumpTo, goTo]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize({ width: w, height: h });
    scrollX.value = PAGES.indexOf(mode) * w;
  };

  // Keep the pager on the current feed after a layout change (rotation, first layout).
  useEffect(() => {
    if (width > 0) pager.current?.scrollTo({ x: PAGES.indexOf(mode) * width, animated: false });
  }, [width]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPagerScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const onShare = useCallback((video: FeedVideo) => setSheet({ video, mode: 'share' }), []);
  const onOptions = useCallback((video: FeedVideo) => setSheet({ video, mode: 'options' }), []);
  const onCreator = useCallback((name: string) => setCreator(name), []);

  const showEmptyFollowing = !followingFeed.loading && followingFeed.videos.length === 0 && !capReached;
  // The tab bar turns dark only while a video is really under it.
  useReportVideoUnderBar(!lock && !(mode === 'following' && showEmptyFollowing));

  return (
    <View style={styles.root} onLayout={onLayout}>
      {width > 0 && height > 0 && (
        // Swipe sideways between Following (left) and For you (right); each page scrolls vertically.
        <Animated.ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: PAGES.indexOf(mode) * width, y: 0 }}
          onScroll={onPagerScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const next = PAGES[Math.round(e.nativeEvent.contentOffset.x / width)] ?? 'forYou';
            if (next !== mode) {
              fx.tab();
              setMode(next);
            }
          }}
        >
          {PAGES.map((m) => {
            const feed = m === 'forYou' ? forYou : followingFeed;
            return (
              <View key={m} style={{ width, height }}>
                {m === 'following' && showEmptyFollowing ? (
                  <FollowingEmpty videos={forYou.videos} top={insets.top + 40} />
                ) : (
                  <FlatList
                    ref={lists[m]}
                    data={feed.videos}
                    keyExtractor={(v) => v.id}
                    onEndReached={feed.loadMore}
                    onEndReachedThreshold={3}
                    renderItem={({ item, index }) => (
                      <FeedItem
                        video={item}
                        height={height}
                        chromeBottom={FEED_CHROME_BOTTOM}
                        // Only the feed on screen plays.
                        active={focused && !lock && mode === m && index === activeIndex[m]}
                        onShare={onShare}
                        onOptions={onOptions}
                        onCreator={onCreator}
                      />
                    )}
                    // One swipe = one video. Without disableIntervalMomentum a fast flick on
                    // Android carries through 2–3 snap points.
                    pagingEnabled
                    snapToInterval={height}
                    snapToAlignment="start"
                    disableIntervalMomentum
                    decelerationRate="fast"
                    showsVerticalScrollIndicator={false}
                    getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
                    onViewableItemsChanged={m === 'forYou' ? onViewableForYou : onViewableFollowing}
                    viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
                    windowSize={3}
                    initialNumToRender={m === mode ? 2 : 1}
                    maxToRenderPerBatch={2}
                    nestedScrollEnabled
                    ListFooterComponent={capReached ? <LockedNext height={height} poster={feed.videos[feed.videos.length - 1]?.thumb} /> : null}
                    ListEmptyComponent={capReached ? <LockedNext height={height} /> : null}
                  />
                )}
              </View>
            );
          })}
        </Animated.ScrollView>
      )}

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <View pointerEvents="none" style={styles.scrimTop} />
        <View style={styles.side} pointerEvents="box-none">
          {active && <LaneBadge variant="media" lane={active.profile.lane} label={t(roleKey(active.profile))} onPress={leaveProfile} />}
        </View>
        <FeedTabs mode={mode} onChange={(m) => goTo(m)} scrollX={scrollX} pageWidth={width} />
        <View style={[styles.side, styles.sideRight]} pointerEvents="box-none">
          <Pressable onPress={() => router.navigate('/discover')} accessibilityRole="button" accessibilityLabel={t('feed.search')} style={styles.search} hitSlop={8}>
            <Icon name="search" size={22} color={alpha(media.text, 0.85)} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      <VideoSheet video={sheet?.video ?? null} mode={sheet?.mode ?? 'share'} onClose={() => setSheet(null)} />
      <CreatorSheet
        name={creator}
        videos={forYou.videos}
        onClose={() => setCreator(null)}
        onOpenVideo={(id) => {
          setCreator(null);
          if (mode !== 'forYou') goTo('forYou', false);
          setTimeout(() => jumpTo(id), 0);
        }}
      />
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

/** Following | For you, with an underline that slides to the selected one. */
function FeedTabs({ mode, onChange, scrollX, pageWidth }: { mode: FeedMode; onChange: (m: FeedMode) => void; scrollX: SharedValue<number>; pageWidth: number }) {
  const { t: tr } = useT();
  const [xs, setXs] = useState<number[]>([0, 0]);
  // The underline tracks the swipe itself, so it moves with your finger, and stretches mid-way.
  const bar = useAnimatedStyle(() => {
    const p = pageWidth > 0 ? Math.min(1, Math.max(0, scrollX.value / pageWidth)) : 1;
    return {
      transform: [
        { translateX: interpolate(p, [0, 1], [xs[0] ?? 0, xs[1] ?? 0]) },
        { scaleX: interpolate(p, [0, 0.5, 1], [1, 2.2, 1]) },
      ],
    };
  });

  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {TABS.map((t, i) => {
        const on = t.mode === mode;
        return (
          <Pressable
            key={t.mode}
            onPress={() => {
              if (t.mode !== mode) fx.tab();
              onChange(t.mode);
            }}
            onLayout={(e) => {
              const { x: left, width } = e.nativeEvent.layout;
              setXs((cur) => Object.assign([...cur], { [i]: left + width / 2 - UNDERLINE / 2 }));
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={styles.tabBtn}
          >
            <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{tr(t.label)}</Text>
          </Pressable>
        );
      })}
      <Animated.View style={[styles.underline, bar]} />
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: color.ink },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrimTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    experimental_backgroundImage: 'linear-gradient(180deg, rgba(10,10,15,0.4), rgba(10,10,15,0))',
  },
  // Equal side slots keep the tabs centred whatever the lane badge's width.
  side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  sideRight: { justifyContent: 'flex-end' },
  tabs: { flexDirection: 'row', gap: 18 },
  tabBtn: { alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  tabText: { color: alpha(media.text, 0.55), fontFamily: font.semibold, fontSize: size.body, textShadowColor: alpha(color.black, 0.35), textShadowRadius: 4 },
  tabTextOn: { color: media.text, fontFamily: font.bold },
  underline: { position: 'absolute', left: 0, bottom: 6, width: UNDERLINE, height: 2, borderRadius: 2, backgroundColor: media.text },
  search: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
}));
