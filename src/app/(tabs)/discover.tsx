import { useIsFocused } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';

import { StatusScrim } from '@/components/StatusScrim';
import { Enter } from '@/components/motion/Enter';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ChannelHubs } from '@/features/discover/ChannelHubs';
import { LaneChip } from '@/features/discover/LaneChip';
import { SearchField } from '@/features/discover/SearchField';
import { ShelfHero } from '@/features/discover/ShelfHero';
import { TopicGrid } from '@/features/discover/TopicGrid';
import { TopTen } from '@/features/discover/TopTen';
import { TrendingGrid } from '@/features/discover/TrendingGrid';
import { useChannels } from '@/features/discover/useChannels';
import { matchesQuery, useDiscover } from '@/features/discover/useDiscover';
import { Segmented } from '@/components/Segmented';
import { FeedVideo } from '@/features/feed/data';
import { openVideo } from '@/features/feed/openVideo';
import { useScreenTime } from '@/features/library/useScreenTime';
import { laneKey, topicLabel, useT } from '@/i18n';
import { color, font, pageFill, size, space, themedStyles } from '@/theme/tokens';

type Tab = 'forYou' | 'channels' | 'topics';
const TABS: Tab[] = ['forYou', 'channels', 'topics'];

export default function DiscoverScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const { profile, videos, topics, shelf, top, loading } = useDiscover();
  const { channels } = useChannels();
  const [tab, setTab] = useState<Tab>('channels');
  const { lock } = useScreenTime();
  const { t, lang } = useT();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<string | null>(null);

  const scroller = useAnimatedRef<Animated.ScrollView>();
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
  const heading = picked ? labelOf(picked.slug) : t('discover.results');

  const open = (v: FeedVideo) => openVideo(v);
  const toTop = () => scroller.current?.scrollTo({ y: 0, animated: true });
  const pickTopic = (slug: string | null) => {
    setTopic(slug);
    if (slug) toTop();
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scroller}
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

        {filtered ? (
          <>
            <Enter index={2} style={styles.sectionHead}>
              <Animated.Text key={heading} entering={FadeIn.duration(220)} style={[styles.h2, styles.shrink]} numberOfLines={1}>
                {heading}
              </Animated.Text>
              <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}>
                <Pressable
                  onPress={() => {
                    setQuery('');
                    setTopic(null);
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>{t('discover.clear')}</Text>
                </Pressable>
              </Animated.View>
            </Enter>
            <TrendingGrid key={topic ?? 'all'} videos={shown} loading={loading} onOpen={open} baseIndex={3} />
          </>
        ) : (
          <>
            <Enter index={2}>
              <Segmented words options={TABS} value={tab} onChange={setTab} label={(k) => (k === 'forYou' ? t('feed.tab.forYou') : t(k === 'channels' ? 'discover.tab.channels' : 'discover.tab.topics'))} />
            </Enter>

            {tab === 'channels' && <ChannelHubs key="channels" channels={channels} baseIndex={3} />}

            {tab === 'forYou' && (
              <>
                {shelf && (
                  <Enter index={3} rise={24}>
                    <ShelfHero
                      topic={shelf.topic}
                      videos={shelf.videos}
                      tags={shelf.videos[0].topics.slice(0, 3).map(labelOf)}
                      scrollY={scrollY}
                      playing={focused && !lock}
                      onPlay={() => open(shelf.videos[0])}
                    />
                  </Enter>
                )}
                {loading ? (
                  <TrendingGrid videos={[]} loading onOpen={open} />
                ) : (
                  top.length >= 3 && (
                    <View style={styles.block}>
                      <Enter index={4}>
                        <SectionHeader title={t('discover.top10', { lane: t(laneKey(profile.lane)) })} />
                      </Enter>
                      <TopTen videos={top} onOpen={open} baseIndex={5} />
                    </View>
                  )
                )}
              </>
            )}

            {tab === 'topics' && topics.length > 0 && (
              <View style={styles.block}>
                <Enter index={3}>
                  <SectionHeader title={t('discover.browseByTopic')} />
                </Enter>
                <TopicGrid topics={topics} selected={topic} onSelect={pickTopic} baseIndex={4} />
              </View>
            )}
          </>
        )}
      </Animated.ScrollView>
      <StatusScrim />
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: -space.sm },
  title: { color: color.text, fontFamily: font.display, fontSize: size.display, letterSpacing: -1, transformOrigin: 'left center' },
  block: { gap: space.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: -space.sm },
  h2: { color: color.text, fontFamily: font.title, fontSize: size.title, letterSpacing: -0.3 },
  shrink: { flexShrink: 1 },
  link: { color: color.text2, fontFamily: font.semibold, fontSize: size.small },
}));
