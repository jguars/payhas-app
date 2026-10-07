import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, LayoutChangeEvent, Pressable, StyleSheet, Text, View, ViewToken } from 'react-native';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';

import { Icon } from '@/components/Icon';
import { LaneBadge } from '@/components/LaneBadge';
import { useFamily } from '@/features/family/FamilyProvider';
import { FeedItem } from '@/features/feed/FeedItem';
import { useFeed } from '@/features/feed/useFeed';
import { TimesUp } from '@/features/library/TimesUp';
import { useScreenTime } from '@/features/library/useScreenTime';
import { color, font } from '@/theme/tokens';

type FeedTab = 'following' | 'forYou';

export default function FeedScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const [height, setHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tab, setTab] = useState<FeedTab>('forYou');
  const { active, leaveProfile } = useFamily();
  const { videos } = useFeed();
  const { lock } = useScreenTime();
  const list = useRef<FlatList>(null);

  // Discover opens a specific video with /?v=<id>: jump straight to it, then drop the param.
  const { v: target } = useLocalSearchParams<{ v?: string }>();
  useEffect(() => {
    if (!target || height === 0 || videos.length === 0) return;
    const index = videos.findIndex((x) => x.id === target);
    if (index >= 0) {
      list.current?.scrollToOffset({ offset: index * height, animated: false });
      setActiveIndex(index);
    }
    router.setParams({ v: undefined });
  }, [target, height, videos]);

  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) setActiveIndex(first.index);
  }).current;

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: height, offset: height * index, index }),
    [height],
  );

  return (
    <View style={styles.root} onLayout={onLayout}>
      {height > 0 && (
        <FlatList
          ref={list}
          data={videos}
          keyExtractor={(v) => v.id}
          renderItem={({ item, index }) => <FeedItem video={item} height={height} chromeBottom={barSpace} active={focused && !lock && index === activeIndex} />}
          pagingEnabled
          snapToInterval={height}
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

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View pointerEvents="none" style={styles.scrimTop} />
        {active && <LaneBadge lane={active.profile.lane} onPress={leaveProfile} />}
        <View style={styles.tabs} accessibilityRole="tablist">
          {(['following', 'forYou'] as const).map((t) => {
            const on = tab === t;
            return (
              <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={styles.tabBtn}>
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{t === 'forYou' ? 'For you' : 'Following'}</Text>
                <View style={[styles.underline, !on && { opacity: 0 }]} />
              </Pressable>
            );
          })}
        </View>
        <Pressable accessibilityLabel="Search" style={styles.search} hitSlop={8}>
          <Icon name="search" size={24} strokeWidth={2.2} />
        </Pressable>
      </View>
      {lock && <TimesUp lock={lock} />}
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
  tabBtn: { alignItems: 'center', gap: 5, minHeight: 44, justifyContent: 'center' },
  tabText: { color: 'rgba(244,243,239,0.7)', fontFamily: font.semibold, fontSize: 16 },
  tabTextOn: { color: color.text, fontFamily: font.bold },
  underline: { width: 18, height: 3, borderRadius: 3, backgroundColor: color.text },
  search: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
