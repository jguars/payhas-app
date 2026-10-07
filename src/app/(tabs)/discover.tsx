import { router, useIsFocused } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';

import { StatusScrim } from '@/components/StatusScrim';
import { Enter } from '@/components/motion/Enter';
import { LaneChip } from '@/features/discover/LaneChip';
import { SearchField } from '@/features/discover/SearchField';
import { ShelfHero } from '@/features/discover/ShelfHero';
import { TopicGrid } from '@/features/discover/TopicGrid';
import { TrendingGrid } from '@/features/discover/TrendingGrid';
import { matchesQuery, useDiscover } from '@/features/discover/useDiscover';
import { FeedVideo } from '@/features/feed/data';
import { useScreenTime } from '@/features/library/useScreenTime';
import { color, font, lane as lanes, space } from '@/theme/tokens';

export default function DiscoverScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const { profile, videos, topics, shelf, loading } = useDiscover();
  const { lock } = useScreenTime();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<string | null>(null);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  // Pulling down past the top swells the title a touch; scrolling away fades it.
  const title = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [1, 0.4], 'clamp'),
    transform: [{ scale: interpolate(scrollY.value, [-90, 0], [1.08, 1], 'clamp') }],
  }));

  const shown = useMemo(
    () => videos.filter((v) => matchesQuery(v, query) && (!topic || v.topics.includes(topic))),
    [videos, query, topic],
  );
  const suggestions = useMemo(() => topics.map((t) => t.label), [topics]);
  const filtered = query.trim().length > 0 || topic != null;

  if (!profile) return <View style={styles.root} />;

  const l = lanes[profile.lane];
  const topicLabel = topics.find((t) => t.slug === topic)?.label;
  const heading = topicLabel ?? (query.trim() ? 'Results' : `Trending in ${l.label}`);

  const open = (v: FeedVideo) => router.navigate({ pathname: '/', params: { v: v.id } });

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: barSpace }]}
        showsVerticalScrollIndicator={false}
      >
        <Enter index={0} style={styles.header}>
          <Animated.Text style={[styles.title, title]} accessibilityRole="header">
            Discover
          </Animated.Text>
          <LaneChip lane={profile.lane} />
        </Enter>

        <Enter index={1}>
          <SearchField value={query} onChange={setQuery} suggestions={suggestions} />
        </Enter>

        {shelf && !filtered && (
          <Enter index={2} rise={24}>
            <ShelfHero
              topic={shelf.topic}
              videos={shelf.videos}
              scrollY={scrollY}
              playing={focused && !lock}
              onPlay={() => open(shelf.videos[0])}
            />
          </Enter>
        )}

        <Enter index={3} style={styles.sectionHead}>
          <Animated.Text key={heading} entering={FadeIn.duration(220)} style={styles.h2}>
            {heading}
          </Animated.Text>
          {filtered && (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}>
              <Pressable
                onPress={() => {
                  setQuery('');
                  setTopic(null);
                }}
                hitSlop={10}
              >
                <Text style={styles.link}>Clear</Text>
              </Pressable>
            </Animated.View>
          )}
        </Enter>
        <TrendingGrid key={topic ?? 'all'} videos={shown} loading={loading} onOpen={open} baseIndex={4} />

        {topics.length > 0 && (
          <>
            <Enter index={7}>
              <Text style={[styles.h2, { marginTop: space.xs }]}>Browse by topic</Text>
            </Enter>
            <TopicGrid topics={topics} selected={topic} onSelect={setTopic} baseIndex={8} />
          </>
        )}
      </Animated.ScrollView>
      <StatusScrim />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: color.text, fontFamily: font.display, fontSize: 30, letterSpacing: -0.9, transformOrigin: 'left center' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.xs },
  h2: { color: color.text, fontFamily: font.bold, fontSize: 18 },
  link: { color: color.text2, fontFamily: font.semibold, fontSize: 13 },
});
