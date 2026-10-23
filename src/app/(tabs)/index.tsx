import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, LayoutChangeEvent, Pressable, StyleSheet, Text, View, ViewToken } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { LaneBadge } from '@/components/LaneBadge';
import { useFamily } from '@/features/family/FamilyProvider';
import { CreatorSheet } from '@/features/feed/CreatorSheet';
import { FeedVideo } from '@/features/feed/data';
import { FeedItem } from '@/features/feed/FeedItem';
import { FollowingEmpty } from '@/features/feed/FollowingEmpty';
import { FeedMode, useFeed } from '@/features/feed/useFeed';
import { SheetMode, VideoSheet } from '@/features/feed/VideoSheet';
import { TimesUp } from '@/features/library/TimesUp';
import { TKey, useT } from '@/i18n';
import { useScreenTime } from '@/features/library/useScreenTime';
import { fx } from '@/lib/feedback';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { color, font } from '@/theme/tokens';

const TABS: { mode: FeedMode; label: TKey }[] = [
  { mode: 'following', label: 'feed.tab.following' },
  { mode: 'forYou', label: 'feed.tab.forYou' },
];

export default function FeedScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const [height, setHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<FeedMode>('forYou');
  const { active, leaveProfile } = useFamily();
  const forYou = useFeed('forYou');
  const followingFeed = useFeed('following');
  const feed = mode === 'forYou' ? forYou : followingFeed;
  const { lock } = useScreenTime();
  const list = useRef<FlatList>(null);
  const { t } = useT();

  const [sheet, setSheet] = useState<{ video: FeedVideo; mode: SheetMode } | null>(null);
  const [creator, setCreator] = useState<string | null>(null);

  const jumpTo = useCallback(
    (id: string) => {
      const index = feed.videos.findIndex((x) => x.id === id);
      if (index < 0 || height === 0) return false;
      list.current?.scrollToOffset({ offset: index * height, animated: false });
      setActiveIndex(index);
      return true;
    },
    [feed.videos, height],
  );

  // Discover, Inbox and Saved open a specific video with /?v=<id>: jump to it in For you.
  const { v: target } = useLocalSearchParams<{ v?: string }>();
  useEffect(() => {
    if (!target) return;
    if (mode !== 'forYou') return setMode('forYou');
    if (height === 0 || forYou.videos.length === 0) return;
    jumpTo(target);
    router.setParams({ v: undefined });
  }, [target, height, forYou.videos, mode, jumpTo]);

  // Switching feeds starts at the top.
  useEffect(() => {
    setActiveIndex(0);
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [mode]);

  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) setActiveIndex(first.index);
  }).current;

  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: height, offset: height * index, index }), [height]);

  const onShare = useCallback((video: FeedVideo) => setSheet({ video, mode: 'share' }), []);
  const onOptions = useCallback((video: FeedVideo) => setSheet({ video, mode: 'options' }), []);
  const onCreator = useCallback((name: string) => setCreator(name), []);

  const showEmptyFollowing = mode === 'following' && !followingFeed.loading && followingFeed.videos.length === 0;

  return (
    <View style={styles.root} onLayout={onLayout}>
      {height > 0 && !showEmptyFollowing && (
        <FlatList
          key={mode}
          ref={list}
          data={feed.videos}
          keyExtractor={(v) => v.id}
          onEndReached={feed.loadMore}
          onEndReachedThreshold={3}
          renderItem={({ item, index }) => (
            <FeedItem
              video={item}
              height={height}
              chromeBottom={barSpace}
              active={focused && !lock && index === activeIndex}
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
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
        />
      )}
      {showEmptyFollowing && <FollowingEmpty videos={forYou.videos} top={insets.top + 40} />}

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View pointerEvents="none" style={styles.scrimTop} />
        {active && <LaneBadge lane={active.profile.lane} onPress={leaveProfile} />}
        <FeedTabs mode={mode} onChange={setMode} />
        <Pressable onPress={() => router.navigate('/discover')} accessibilityRole="button" accessibilityLabel={t('feed.search')} style={styles.search} hitSlop={8}>
          <Icon name="search" size={24} strokeWidth={2.2} />
        </Pressable>
      </View>

      <VideoSheet video={sheet?.video ?? null} mode={sheet?.mode ?? 'share'} onClose={() => setSheet(null)} />
      <CreatorSheet
        name={creator}
        videos={forYou.videos}
        onClose={() => setCreator(null)}
        onOpenVideo={(id) => {
          setCreator(null);
          if (mode !== 'forYou') setMode('forYou');
          setTimeout(() => jumpTo(id), 0);
        }}
      />
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

/** Following | For you, with an underline that slides to the selected one. */
function FeedTabs({ mode, onChange }: { mode: FeedMode; onChange: (m: FeedMode) => void }) {
  const { t: tr } = useT();
  const [xs, setXs] = useState<number[]>([0, 0]);
  const index = TABS.findIndex((t) => t.mode === mode);
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(xs[index] ?? 0, spring.snappy);
  }, [index, xs, x]);
  const bar = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

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
              setXs((cur) => Object.assign([...cur], { [i]: left + width / 2 - 9 }));
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={styles.tabBtn}
          >
            <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{tr(t.label)}</Text>
          </Pressable>
        );
      })}
      <Animated.View style={[styles.underline, bar]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scrimTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    experimental_backgroundImage: 'linear-gradient(180deg, rgba(10,10,15,0.55), rgba(10,10,15,0))',
  },
  tabs: { flexDirection: 'row', gap: 20 },
  tabBtn: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  tabText: { color: 'rgba(244,243,239,0.7)', fontFamily: font.semibold, fontSize: 16 },
  tabTextOn: { color: color.text, fontFamily: font.bold },
  underline: { position: 'absolute', left: 0, bottom: 4, width: 18, height: 3, borderRadius: 3, backgroundColor: color.text },
  search: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
