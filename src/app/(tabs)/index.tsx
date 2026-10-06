import { useIsFocused } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, LayoutChangeEvent, Pressable, StyleSheet, Text, View, ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { LaneBadge } from '@/components/LaneBadge';
import { seedFeed } from '@/features/feed/data';
import { FeedItem } from '@/features/feed/FeedItem';
import { color, font } from '@/theme/tokens';

type FeedTab = 'following' | 'forYou';

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [height, setHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tab, setTab] = useState<FeedTab>('forYou');

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
          data={seedFeed}
          keyExtractor={(v) => v.id}
          renderItem={({ item, index }) => <FeedItem video={item} height={height} active={focused && index === activeIndex} />}
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
        <LaneBadge lane="kids" />
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
