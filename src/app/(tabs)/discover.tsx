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
import { laneKey, topicLabel, useT } from '@/i18n';
import { color, font, space } from '@/theme/tokens';

export default function DiscoverScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const { profile, videos, topics, shelf, loading } = useDiscover();
  const { lock } = useScreenTime();
  const { t, lang } = useT();
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

  // Topic labels in the app's language, so searching "hayvan" finds Animals.
  const labelOf = useMemo(() => {
    const m = new Map(topics.map((tp) => [tp.slug, topicLabel(t, tp.slug, tp.label)]));
    return (slug: string) => m.get(slug) ?? topicLabel(t, slug, slug);
  }, [topics, t]);
  const shown = useMemo(
    () => videos.filter((v) => matchesQuery(v, query, labelOf, lang) && (!topic || v.topics.includes(topic))),
    [videos, query, topic, labelOf, lang],
  );
  const suggestions = useMemo(() => topics.map((tp) => labelOf(tp.slug)), [topics, labelOf]);
  const filtered = query.trim().length > 0 || topic != null;

  if (!profile) return <View style={styles.root} />;

  const picked = topics.find((tp) => tp.slug === topic);
  const heading = picked
    ? labelOf(picked.slug)
    : query.trim()
      ? t('discover.results')
      : t('discover.trendingIn', { lane: t(laneKey(profile.lane)) });

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
            {t('discover.title')}
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
          <Animated.Text key={heading} entering={FadeIn.duration(220)} style={[styles.h2, styles.shrink]} numberOfLines={1}>
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
                <Text style={styles.link}>{t('discover.clear')}</Text>
              </Pressable>
            </Animated.View>
          )}
        </Enter>
        <TrendingGrid key={topic ?? 'all'} videos={shown} loading={loading} onOpen={open} baseIndex={4} />

        {topics.length > 0 && (
          <>
            <Enter index={7}>
              <Text style={[styles.h2, { marginTop: space.xs }]}>{t('discover.browseByTopic')}</Text>
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
  shrink: { flexShrink: 1 },
  link: { color: color.text2, fontFamily: font.semibold, fontSize: 13 },
});
