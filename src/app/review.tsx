import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { reasonLabel, useReviewQueue } from '@/features/creator/useReviewQueue';
import { mediaFor } from '@/features/feed/data';
import { laneKey, localized, type T, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useInsets } from '@/lib/useInsets';
import { alpha, color, font, radius, space } from '@/theme/tokens';

type Tab = 'uploads' | 'reports';

const ago = (t: T, iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60
    ? t('creator.agoMin', { count: m })
    : m < 1440
      ? t('creator.agoHour', { count: Math.round(m / 60) })
      : t('creator.agoDay', { count: Math.round(m / 1440) });
};

/** Moderator queue: new uploads waiting for a decision, and reported videos. */
export default function ReviewScreen() {
  const { uploads, reports, urls, loaded, reload } = useReviewQueue();
  const toast = useToast();
  const { t, lang } = useT();
  const { bottom } = useInsets();
  const [tab, setTab] = useState<Tab>('uploads');

  const open = (id: string, mode: Tab) => {
    fx.tap();
    router.push({ pathname: '/review-item', params: { id, mode } });
  };

  // For an imported batch already watched in the list: publish everything as suggested.
  const approveAll = () => {
    fx.tap();
    Alert.alert(t('creator.approveAllTitle', { count: uploads.length }), t('creator.approveAllBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('creator.approveAll'),
        onPress: async () => {
          const { data, error } = await supabase.rpc('approve_videos', { p_ids: uploads.map((u) => u.id) });
          if (error) return fx.error();
          fx.success();
          toast({ text: t('creator.nowLive', { count: Number(data ?? 0) }), icon: 'check' });
          reload();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('creator.reviewTitle')} />
      <View style={styles.tabs}>
        {(['uploads', 'reports'] as Tab[]).map((k) => {
          const on = tab === k;
          const n = k === 'uploads' ? uploads.length : reports.length;
          return (
            <Pressable
              key={k}
              onPress={() => {
                if (!on) fx.tab();
                setTab(k);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text style={[styles.tabText, on && { color: color.ink }]}>{k === 'uploads' ? t('creator.newUploads') : t('creator.reports')}</Text>
              {n > 0 && (
                <View style={[styles.count, on && { backgroundColor: color.ink }]}>
                  <Text style={[styles.countText, on && { color: color.text }]}>{n}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <ScrollView key={tab} contentContainerStyle={[styles.list, { paddingBottom: bottom + space.xl }]}>
        {loaded && (tab === 'uploads' ? uploads.length : reports.length) === 0 && (
          <Enter index={0} style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="check" size={28} color="#4FE3B0" strokeWidth={2.6} />
            </View>
            <Text style={styles.emptyTitle}>{t('creator.allClear')}</Text>
            <Text style={styles.emptySub}>{tab === 'uploads' ? t('creator.noUploads') : t('creator.noReports')}</Text>
          </Enter>
        )}

        {tab === 'uploads' && uploads.length > 1 && (
          <PressScale onPress={approveAll} accessibilityRole="button" style={styles.approveAll}>
            <Icon name="check" size={16} color={color.ink} strokeWidth={2.8} />
            <Text style={styles.approveAllText}>{t('creator.approveAllButton', { count: uploads.length })}</Text>
          </PressScale>
        )}
        {tab === 'uploads' &&
          uploads.map((v, i) => {
            const m = mediaFor(v, urls);
            return (
              <Enter key={v.id} index={i}>
                <PressScale onPress={() => open(v.id, 'uploads')} accessibilityRole="button" style={styles.row}>
                  {m ? <Image source={m.thumb} cachePolicy="memory-disk" style={styles.thumb} /> : <View style={styles.thumb} />}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.caption} numberOfLines={2}>
                      {localized(lang, v.caption, v.caption_i18n)}
                    </Text>
                    <Text style={styles.meta}>
                      {t('creator.suggests', { creator: v.creator_name, lane: t(laneKey(v.lane)), ago: ago(t, v.created_at) })}
                    </Text>
                    {!!v.attribution && (
                      <Text style={styles.meta} numberOfLines={1}>
                        {v.attribution}
                      </Text>
                    )}
                  </View>
                  <Icon name="chevron" size={16} color={color.text3} strokeWidth={2.4} />
                </PressScale>
              </Enter>
            );
          })}

        {tab === 'reports' &&
          reports.map((r, i) => {
            const m = mediaFor(r, urls);
            const reasons = Object.entries((r.reasons ?? {}) as Record<string, number>);
            return (
              <Enter key={r.video_id} index={i}>
                <PressScale onPress={() => open(r.video_id, 'reports')} accessibilityRole="button" style={styles.row}>
                  {m ? <Image source={m.thumb} cachePolicy="memory-disk" style={styles.thumb} /> : <View style={styles.thumb} />}
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.caption} numberOfLines={1}>
                      {localized(lang, r.caption, r.caption_i18n)}
                    </Text>
                    <View style={styles.reasons}>
                      {reasons.map(([reason, n]) => (
                        <View key={reason} style={styles.reasonPill}>
                          <Text style={styles.reasonText}>
                            {reasonLabel(t, reason)} ×{n}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.flagCount}>
                    <Icon name="flag" size={12} color="#FF8A73" />
                    <Text style={styles.flagText}>{r.report_count}</Text>
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
  tabs: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: color.surface1 },
  tabOn: { backgroundColor: color.text },
  tabText: { color: color.text, fontFamily: font.semibold, fontSize: 14 },
  count: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  countText: { color: color.ink, fontFamily: font.bold, fontSize: 11 },
  list: { paddingHorizontal: space.lg, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 18, backgroundColor: color.surface1 },
  thumb: { width: 56, height: 74, borderRadius: 10, backgroundColor: color.surface2 },
  caption: { color: color.text, fontFamily: font.semibold, fontSize: 14 },
  meta: { color: color.text3, fontFamily: font.medium, fontSize: 12 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  reasonPill: { paddingHorizontal: 8, height: 22, borderRadius: radius.pill, backgroundColor: alpha(color.danger, 0.14), justifyContent: 'center' },
  reasonText: { color: color.danger, fontFamily: font.semibold, fontSize: 12 },
  flagCount: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  flagText: { color: color.danger, fontFamily: font.mono, fontSize: 13 },
  approveAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 46, borderRadius: radius.pill, backgroundColor: color.success, marginBottom: space.sm },
  approveAllText: { color: color.ink, fontFamily: font.bold, fontSize: 15 },
  empty: { alignItems: 'center', gap: space.sm, paddingTop: 100 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: alpha(color.success, 0.14), alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  emptyTitle: { color: color.text, fontFamily: font.title, fontSize: 20 },
  emptySub: { color: color.text2, fontFamily: font.medium, fontSize: 14 },
});
