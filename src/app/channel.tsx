import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ChannelAvatar } from '@/features/discover/ChannelAvatar';
import { FollowButton } from '@/features/discover/ChannelHubs';
import { channelLook } from '@/features/discover/useChannels';
import { useFamily } from '@/features/family/FamilyProvider';
import { FeedVideo, formatCount, toFeedVideos, VideoRow } from '@/features/feed/data';
import { openVideo } from '@/features/feed/openVideo';
import { topicLabel, useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useInsets } from '@/lib/useInsets';
import { color, font, pageFill, radius, space, themedStyles } from '@/theme/tokens';

/** One channel: who it is, a Follow button, and every video this lane may watch, newest first. */
export default function ChannelScreen() {
  const { name = '' } = useLocalSearchParams<{ name: string }>();
  const { active } = useFamily();
  const { t, lang } = useT();
  const { bottom } = useInsets();
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!active || !name) return;
    // get_channel_videos arrives with migration 20261029090000; the generated types don't know it yet.
    (supabase.rpc as unknown as (fn: string, args: object) => Promise<{ data: VideoRow[] | null }>)('get_channel_videos', { p_session: active.token, p_creator: name, p_limit: 60 }).then(
      async ({ data }) => {
        setVideos(await toFeedVideos(data, lang));
        setLoaded(true);
      },
    );
  }, [active, name, lang]);

  // The topics this channel covers most, for the line under its name.
  const counts = new Map<string, number>();
  for (const v of videos) for (const s of v.topics) counts.set(s, (counts.get(s) ?? 0) + 1);
  const topics = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const look = channelLook(name, topics);

  return (
    <View style={styles.root}>
      <ScreenHeader title="" />
      <ScrollView contentContainerStyle={{ paddingBottom: bottom + space.xl, gap: space.xl }}>
        <Enter index={0} style={styles.hero}>
          <ChannelAvatar look={look} size={112} />
          <Text style={styles.name} accessibilityRole="header">
            {name}
          </Text>
          <Text style={styles.meta}>
            {[loaded ? t('discover.channelVideos', { count: videos.length }) : null, topics.slice(0, 3).map((s) => topicLabel(t, s, s)).join(', ')]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <FollowButton name={name} big />
        </Enter>

        <View style={styles.grid}>
          {videos.map((v, i) => (
            <Enter key={v.id} index={1 + Math.min(i, 12)} style={styles.cell}>
              <PressScale onPress={() => openVideo(v)} accessibilityRole="button" accessibilityLabel={v.caption} style={styles.tile}>
                <Image source={v.thumb} cachePolicy="memory-disk" recyclingKey={v.id} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={styles.views}>
                  <Icon name="play" size={10} filled />
                  <Text style={styles.viewsText}>{formatCount(v.views)}</Text>
                </View>
              </PressScale>
            </Enter>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  hero: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl },
  name: { color: color.text, fontFamily: font.display, fontSize: 28, letterSpacing: -0.8, textAlign: 'center', marginTop: space.sm },
  meta: { color: color.text2, fontFamily: font.semibold, fontSize: 14, textAlign: 'center', marginBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: space.lg },
  cell: { width: '32.4%' },
  tile: { aspectRatio: 3 / 4, borderRadius: radius.chip, overflow: 'hidden', backgroundColor: color.surface1 },
  views: { position: 'absolute', left: 8, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewsText: { color: color.white, fontFamily: font.mono, fontSize: 12 },
}));
