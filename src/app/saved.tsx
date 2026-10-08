import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useFamily } from '@/features/family/FamilyProvider';
import { FeedVideo, formatCount, toFeedVideos } from '@/features/feed/data';
import { useLibrary } from '@/features/library/LibraryProvider';
import { supabase } from '@/lib/supabase';
import { useInsets } from '@/lib/useInsets';
import { color, font, radius, space } from '@/theme/tokens';

/** Everything this profile saved, newest first — a three-up poster grid like any saved collection. */
export default function SavedScreen() {
  const { active } = useFamily();
  const { saved } = useLibrary();
  const { bottom } = useInsets();
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      supabase.rpc('get_saved', { p_session: active.token }).then(async ({ data }) => {
        setVideos(await toFeedVideos(data));
        setLoaded(true);
      });
    }, [active]),
  );

  // Unsaving from the feed while this screen is open removes the tile straight away.
  const shown = videos.filter((v) => saved.has(v.id));

  return (
    <View style={styles.root}>
      <ScreenHeader title="Saved" />
      {loaded && shown.length === 0 ? (
        <Enter index={0} style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="save" size={28} color={color.text2} />
          </View>
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptySub}>Tap the bookmark on a video to keep it here.</Text>
        </Enter>
      ) : (
        <ScrollView contentContainerStyle={[styles.grid, { paddingBottom: bottom + space.xl }]}>
          {shown.map((v, i) => (
            <Enter key={v.id} index={i} style={styles.cell}>
              <PressScale onPress={() => router.navigate({ pathname: '/', params: { v: v.id } })} accessibilityRole="button" accessibilityLabel={v.caption} style={styles.tile}>
                <Image source={v.thumb} style={styles.fill} resizeMode="cover" />
                <View style={styles.views}>
                  <Icon name="play" size={10} />
                  <Text style={styles.viewsText}>{formatCount(v.views)}</Text>
                </View>
              </PressScale>
            </Enter>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, paddingHorizontal: 3 },
  cell: { width: '32.9%' },
  tile: { aspectRatio: 3 / 4, borderRadius: radius.chip / 2, overflow: 'hidden', backgroundColor: color.surface1 },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  views: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewsText: { color: color.text, fontFamily: font.mono, fontSize: 11 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.xxl, paddingBottom: 80 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: color.surface1, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  emptyTitle: { color: color.text, fontFamily: font.title, fontSize: 20 },
  emptySub: { color: color.text2, fontFamily: font.medium, fontSize: 14, textAlign: 'center' },
});
