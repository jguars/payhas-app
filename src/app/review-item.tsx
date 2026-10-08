import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { REASON_LABEL, REJECT_REASONS, useReviewQueue } from '@/features/creator/useReviewQueue';
import { MediaSource, mediaFor } from '@/features/feed/data';
import { Constants, Tables } from '@/lib/database.types';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useInsets } from '@/lib/useInsets';
import { color, font, Lane, lane as lanes, radius, space } from '@/theme/tokens';

const GREEN = '#4FE3B0';
const RED = '#FF8A73';

/** One item from the queue: watch it, set lane + topics, then decide. */
export default function ReviewItemScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode: 'uploads' | 'reports' }>();
  const { uploads, reports, urls, loaded } = useReviewQueue();
  const { bottom } = useInsets();
  const toast = useToast();
  const [interests, setInterests] = useState<Tables<'interests'>[]>([]);
  const [lane, setLane] = useState<Lane | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [reasonFor, setReasonFor] = useState<'reject' | 'remove' | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = uploads.find((u) => u.id === id);
  const report = reports.find((r) => r.video_id === id);
  const item = mode === 'reports' ? report : upload;
  const media = item ? mediaFor(item, urls) : null;

  useEffect(() => {
    supabase.from('interests').select('*').order('sort').then(({ data }) => setInterests(data ?? []));
  }, []);
  // Start from the creator's suggestion.
  useEffect(() => {
    if (upload && lane == null) {
      setLane(upload.lane);
      setTopics(upload.topics);
    }
  }, [upload]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (text: string) => {
    fx.success();
    toast({ text, icon: 'check' });
    router.back();
  };

  const approve = async () => {
    if (!upload || !lane) return;
    setBusy(true);
    const { error } = await supabase.rpc('review_video', { p_video_id: upload.id, p_approve: true, p_lane: lane, p_topics: topics });
    setBusy(false);
    if (error) return fx.error();
    finish(`Approved for ${lanes[lane].label}`);
  };

  const decide = async (reason: string) => {
    setReasonFor(null);
    setBusy(true);
    const { error } =
      reasonFor === 'reject' && upload
        ? await supabase.rpc('review_video', { p_video_id: upload.id, p_approve: false, p_lane: lane ?? upload.lane, p_topics: topics, p_reason: reason })
        : await supabase.rpc('resolve_reports', { p_video_id: id, p_remove: true, p_reason: reason });
    setBusy(false);
    if (error) return fx.error();
    finish(reasonFor === 'reject' ? 'Not approved' : 'Taken down');
  };

  const keep = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('resolve_reports', { p_video_id: id, p_remove: false });
    setBusy(false);
    if (error) return fx.error();
    finish('Kept — reports closed');
  };

  if (loaded && !item) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Review" />
        <Text style={styles.gone}>Already handled.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={mode === 'reports' ? 'Reported video' : 'New upload'} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 120 }]}>
        <View style={styles.playerWrap}>{media && <Player source={media.source} />}</View>

        {item && (
          <View style={{ gap: 4 }}>
            <Text style={styles.caption}>{item.caption}</Text>
            <Text style={styles.meta}>
              {item.creator_name} · rated {lanes[item.lane].label}
              {upload?.duration_s ? ` · ${Math.round(upload.duration_s)}s` : ''}
            </Text>
          </View>
        )}

        {report && (
          <View style={styles.reportBox}>
            <Icon name="flag" size={16} color={RED} />
            <Text style={styles.reportText}>
              {report.report_count} {report.report_count === 1 ? 'report' : 'reports'}:{' '}
              {Object.entries((report.reasons ?? {}) as Record<string, number>)
                .map(([r, n]) => `${REASON_LABEL[r] ?? r} ×${n}`)
                .join(', ')}
            </Text>
          </View>
        )}

        {upload && (
          <>
            <View style={{ gap: space.sm }}>
              <Text style={styles.label}>Youngest lane it’s right for</Text>
              <View style={styles.lanes}>
                {Constants.public.Enums.lane.map((l) => {
                  const L = lanes[l];
                  const on = lane === l;
                  return (
                    <Pressable
                      key={l}
                      onPress={() => {
                        fx.tab();
                        setLane(l);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[styles.lane, { borderColor: on ? L.color : color.line }, on && { backgroundColor: L.color + '22' }]}
                    >
                      <Text style={[styles.laneLabel, { color: on ? L.color : color.text }]}>{L.label}</Text>
                      <Text style={styles.laneAges}>{L.ages}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.help}>Little-lane videos are only shown after this human check — be strict.</Text>
            </View>

            <View style={{ gap: space.sm }}>
              <Text style={styles.label}>Topics</Text>
              <View style={styles.chips}>
                {interests.map((i) => {
                  const on = topics.includes(i.slug);
                  return (
                    <Pressable
                      key={i.slug}
                      onPress={() => {
                        fx.tab();
                        setTopics((t) => (on ? t.filter((x) => x !== i.slug) : [...t, i.slug].slice(-3)));
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={styles.chipEmoji}>{i.emoji}</Text>
                      <Text style={[styles.chipText, on && { color: color.ink }]}>{i.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottom + space.md }]}>
        {mode === 'reports' ? (
          <>
            <Decision label="Keep" icon="check" tone="neutral" disabled={busy} onPress={keep} />
            <Decision label="Take down" icon="eyeOff" tone="bad" disabled={busy} onPress={() => setReasonFor('remove')} />
          </>
        ) : (
          <>
            <Decision label="Reject" icon="close" tone="bad" disabled={busy} onPress={() => setReasonFor('reject')} />
            <Decision label="Approve" icon="check" tone="good" disabled={busy || !lane || topics.length === 0} onPress={approve} />
          </>
        )}
      </View>

      <BottomSheet open={!!reasonFor} onClose={() => setReasonFor(null)} title={reasonFor === 'remove' ? 'Why take it down?' : 'Why not approve?'}>
        <View style={{ gap: space.sm, paddingHorizontal: space.xl }}>
          {REJECT_REASONS.map((r) => (
            <PressScale key={r} onPress={() => decide(r)} pressedScale={0.97} accessibilityRole="button" style={styles.reasonRow}>
              <Text style={styles.reasonRowText}>{r}</Text>
              <Icon name="chevron" size={16} color={color.text3} strokeWidth={2.4} />
            </PressScale>
          ))}
          <Text style={styles.help}>The creator sees this reason in their Inbox.</Text>
        </View>
      </BottomSheet>
    </View>
  );
}

function Player({ source }: { source: MediaSource }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={styles.player} contentFit="contain" nativeControls />;
}

function Decision({ label, icon, tone, disabled, onPress }: { label: string; icon: 'check' | 'close' | 'eyeOff'; tone: 'good' | 'bad' | 'neutral'; disabled?: boolean; onPress: () => void }) {
  const bg = tone === 'good' ? GREEN : tone === 'bad' ? 'rgba(255,138,115,0.14)' : color.surface2;
  const fg = tone === 'good' ? color.ink : tone === 'bad' ? RED : color.text;
  return (
    <PressScale onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.decision, { backgroundColor: bg }, disabled && { opacity: 0.4 }]}>
      <Icon name={icon} size={18} color={fg} strokeWidth={2.6} />
      <Text style={[styles.decisionText, { color: fg }]}>{label}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  content: { paddingHorizontal: space.lg, gap: space.xl },
  playerWrap: { height: 420, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#000' },
  player: { width: '100%', height: '100%' },
  caption: { color: color.text, fontFamily: font.bold, fontSize: 17 },
  meta: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  reportBox: { flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.md, borderRadius: 14, backgroundColor: 'rgba(255,138,115,0.1)' },
  reportText: { flex: 1, color: RED, fontFamily: font.semibold, fontSize: 13 },
  label: { color: color.text, fontFamily: font.bold, fontSize: 15 },
  help: { color: color.text3, fontFamily: font.medium, fontSize: 12 },
  lanes: { flexDirection: 'row', gap: space.sm },
  lane: { flex: 1, paddingVertical: space.md, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', gap: 2 },
  laneLabel: { fontFamily: font.bold, fontSize: 14 },
  laneAges: { color: color.text3, fontFamily: font.medium, fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line },
  chipOn: { backgroundColor: color.text, borderColor: color.text },
  chipEmoji: { fontSize: 15 },
  chipText: { color: color.text, fontFamily: font.semibold, fontSize: 13 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.ink, borderTopWidth: 1, borderTopColor: color.surface2 },
  decision: { flex: 1, height: 54, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  decisionText: { fontFamily: font.bold, fontSize: 16 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 54, paddingHorizontal: space.lg, borderRadius: 16, backgroundColor: color.surface2 },
  reasonRowText: { flex: 1, color: color.text, fontFamily: font.semibold, fontSize: 15 },
  gone: { color: color.text2, fontFamily: font.medium, fontSize: 15, textAlign: 'center', marginTop: 120 },
});
