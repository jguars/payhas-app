import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, IconName } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useRoles } from '@/features/creator/useRoles';
import { rejectReasonLabel, REVIEW_ENABLED } from '@/features/creator/useReviewQueue';
import { formatCount, mediaFor, signMedia, VideoRow } from '@/features/feed/data';
import { laneKey, localized, type TKey, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useInsets } from '@/lib/useInsets';
import { color, font, radius, space } from '@/theme/tokens';

const STATUS: Record<string, { label: TKey; tint: string; icon: IconName }> = {
  pending: { label: 'creator.status.pending', tint: '#FFD25E', icon: 'clock' },
  published: { label: 'creator.status.published', tint: '#4FE3B0', icon: 'check' },
  rejected: { label: 'creator.status.rejected', tint: '#FF8A73', icon: 'close' },
  removed: { label: 'creator.status.removed', tint: color.text3, icon: 'flag' },
};

/** A creator's own uploads and where each one stands. */
export default function StudioScreen() {
  const { creator_name } = useRoles();
  const { t, lang } = useT();
  const { bottom } = useInsets();
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      supabase.rpc('get_my_uploads').then(async ({ data }) => {
        const list = data ?? [];
        setUrls(await signMedia(list));
        setRows(list);
        setLoaded(true);
      });
    }, []),
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('creator.studioTitle')} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + space.xl }]}>
        <Enter index={0}>
          <PressScale
            onPress={() => {
              fx.tap();
              router.push('/upload');
            }}
            accessibilityRole="button"
            style={styles.upload}
          >
            <View style={styles.uploadIcon}>
              <Icon name="plus" size={24} color={color.ink} strokeWidth={2.6} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.uploadTitle}>{t('creator.uploadVideo')}</Text>
              <Text style={styles.uploadSub}>
                {t('creator.uploadAs', {
                  name: creator_name ?? t('creator.creatorFallback'),
                  how: REVIEW_ENABLED ? t('creator.checkedFirst') : t('creator.liveRightAway'),
                })}
              </Text>
            </View>
            <Icon name="chevron" size={18} color={color.ink} strokeWidth={2.6} />
          </PressScale>
        </Enter>

        {loaded && rows.length === 0 && (
          <Enter index={1}>
            <Text style={styles.empty}>{t('creator.studioEmpty')}</Text>
          </Enter>
        )}

        {rows.map((r, i) => {
          const s = STATUS[r.status] ?? STATUS.pending;
          const media = mediaFor(r, urls);
          const caption = localized(lang, r.caption, r.caption_i18n);
          const label = t(s.label);
          return (
            <Enter key={r.id} index={1 + i} style={styles.row}>
              <PressScale
                disabled={r.status !== 'published'}
                onPress={() => router.navigate({ pathname: '/', params: { v: r.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${caption}, ${label}`}
                style={styles.rowInner}
              >
                {media ? <Image source={media.thumb} style={styles.thumb} resizeMode="cover" /> : <View style={styles.thumb} />}
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.caption} numberOfLines={2}>
                    {caption}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.pill, { backgroundColor: s.tint + '24' }]}>
                      <Icon name={s.icon} size={11} color={s.tint} strokeWidth={2.8} />
                      <Text style={[styles.pillText, { color: s.tint }]}>{label}</Text>
                    </View>
                    <Text style={styles.meta}>{t(laneKey(r.lane))}</Text>
                    {r.status === 'published' && <Text style={styles.meta}>· {t('creator.views', { count: r.view_count, n: formatCount(r.view_count) })}</Text>}
                  </View>
                  {(r.status === 'rejected' || r.status === 'removed') && !!r.review_reason && (
                    <Text style={styles.reason} numberOfLines={2}>
                      {rejectReasonLabel(t, r.review_reason)}
                    </Text>
                  )}
                </View>
              </PressScale>
            </Enter>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  content: { paddingHorizontal: space.lg, gap: space.sm },
  upload: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: color.ember, marginBottom: space.md },
  uploadIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(10,10,15,0.15)', alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { color: color.ink, fontFamily: font.bold, fontSize: 17 },
  uploadSub: { color: 'rgba(10,10,15,0.7)', fontFamily: font.medium, fontSize: 12 },
  empty: { color: color.text3, fontFamily: font.medium, fontSize: 14, textAlign: 'center', marginTop: space.xl },
  row: {},
  rowInner: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: 18, backgroundColor: color.surface1 },
  thumb: { width: 60, height: 80, borderRadius: 10, backgroundColor: color.surface2 },
  caption: { color: color.text, fontFamily: font.semibold, fontSize: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: radius.pill },
  pillText: { fontFamily: font.bold, fontSize: 11 },
  meta: { color: color.text3, fontFamily: font.medium, fontSize: 12 },
  reason: { color: color.text2, fontFamily: font.medium, fontSize: 12 },
});
