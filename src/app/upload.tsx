import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { Ring } from '@/components/motion/Ring';
import { ScreenHeader } from '@/components/ScreenHeader';
import { MAX_BYTES, MAX_SECONDS, uploadFile } from '@/features/creator/upload';
import { Constants, Tables } from '@/lib/database.types';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useInsets } from '@/lib/useInsets';
import { color, font, Lane, lane as lanes, radius, space } from '@/theme/tokens';

type Picked = { uri: string; seconds: number; type: string };
type Stage = 'form' | 'uploading' | 'done';
const STEPS = ['Preparing', 'Uploading video', 'Uploading poster', 'Sending for review'];
const MAX_TOPICS = 3;
const CAPTION_MAX = 150;

export default function UploadScreen() {
  const { bottom } = useInsets();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [lane, setLane] = useState<Lane | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [interests, setInterests] = useState<Tables<'interests'>[]>([]);
  const [stage, setStage] = useState<Stage>('form');
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('interests').select('*').order('sort').then(({ data }) => setInterests(data ?? []));
  }, []);

  const pick = async () => {
    fx.tap();
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: MAX_SECONDS, quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const seconds = (a.duration ?? 0) / 1000;
    if (seconds > MAX_SECONDS + 0.5) return setError(`That one is ${Math.round(seconds)}s — videos can be up to ${MAX_SECONDS}s.`);
    if (a.fileSize && a.fileSize > MAX_BYTES) return setError('That file is over 50 MB. Try a shorter clip or lower quality.');
    setPicked({ uri: a.uri, seconds: Math.max(1, seconds), type: a.mimeType ?? 'video/mp4' });
  };

  const ready = !!picked && caption.trim().length > 0 && topics.length > 0 && !!lane && agreed;

  const submit = async () => {
    if (!picked || !lane) return;
    fx.tap();
    setStage('uploading');
    setError(null);
    try {
      setStep(0);
      const thumb = await VideoThumbnails.getThumbnailAsync(picked.uri, { time: Math.min(1000, picked.seconds * 500), quality: 0.7 });
      const { data, error: err } = await supabase.rpc('create_upload', {
        p_caption: caption.trim(),
        p_topics: topics,
        p_lane: lane,
        p_duration: Math.min(MAX_SECONDS, picked.seconds),
      });
      if (err) throw new Error(err.message);
      const slot = data as { video_id: string; storage_path: string; thumb_path: string };

      setStep(1);
      await uploadFile(slot.storage_path, picked.uri, picked.type, setProgress);
      setStep(2);
      await uploadFile(slot.thumb_path, thumb.uri, 'image/jpeg');
      setStep(3);
      const done = await supabase.rpc('finish_upload', { p_video_id: slot.video_id });
      if (done.error) throw new Error(done.error.message);

      fx.success();
      setStage('done');
    } catch (e) {
      fx.error();
      setError(e instanceof Error ? e.message : 'Upload failed');
      setStage('form');
    }
  };

  if (stage === 'done') {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <Enter index={0} rise={18}>
            <View style={styles.doneBadge}>
              <Icon name="check" size={40} color={color.ink} strokeWidth={3} />
            </View>
          </Enter>
          <Enter index={2}>
            <Text style={styles.doneTitle}>Sent for review</Text>
          </Enter>
          <Enter index={3}>
            <Text style={styles.doneSub}>A moderator checks every video before children can see it. You’ll hear back in your Inbox.</Text>
          </Enter>
          <Enter index={5} style={styles.doneRow}>
            <PressScale onPress={() => router.back()} accessibilityRole="button" style={[styles.button, styles.secondary]}>
              <Text style={[styles.buttonText, { color: color.text }]}>Done</Text>
            </PressScale>
            <PressScale
              onPress={() => {
                setPicked(null);
                setCaption('');
                setTopics([]);
                setLane(null);
                setAgreed(false);
                setProgress(0);
                setStage('form');
              }}
              accessibilityRole="button"
              style={styles.button}
            >
              <Text style={styles.buttonText}>Upload another</Text>
            </PressScale>
          </Enter>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="New video" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 110 }]} keyboardShouldPersistTaps="handled">
        {picked ? <Preview picked={picked} onChange={pick} /> : <PickCard onPress={pick} />}
        {error && (
          <Animated.View entering={FadeIn.duration(160)} style={styles.error}>
            <Icon name="help" size={16} color="#FF8A73" />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}

        <Field label="Caption" hint={`${caption.length}/${CAPTION_MAX}`}>
          <TextInput
            value={caption}
            onChangeText={(t) => setCaption(t.slice(0, CAPTION_MAX))}
            placeholder="What happens in this video?"
            placeholderTextColor={color.text3}
            multiline
            style={styles.input}
          />
        </Field>

        <Field label="Topics" hint={`up to ${MAX_TOPICS}`}>
          <View style={styles.chips}>
            {interests.map((i) => {
              const on = topics.includes(i.slug);
              const full = !on && topics.length >= MAX_TOPICS;
              return (
                <Pressable
                  key={i.slug}
                  disabled={full}
                  onPress={() => {
                    fx.tab();
                    setTopics((t) => (on ? t.filter((x) => x !== i.slug) : [...t, i.slug]));
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: full }}
                  style={[styles.chip, on && styles.chipOn, full && { opacity: 0.35 }]}
                >
                  <Text style={styles.chipEmoji}>{i.emoji}</Text>
                  <Text style={[styles.chipText, on && { color: color.ink }]}>{i.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Youngest age it suits" hint="a moderator confirms">
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
        </Field>

        <Pressable
          onPress={() => {
            fx.toggle(!agreed);
            setAgreed((a) => !a);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          style={styles.agree}
        >
          <View style={[styles.box, agreed && styles.boxOn]}>{agreed && <Icon name="check" size={14} color={color.ink} strokeWidth={3} />}</View>
          <Text style={styles.agreeText}>
            I made this or have the rights to it. It has no ads, no personal details, and nobody is filmed without permission.
          </Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottom + space.md }]}>
        <PressScale onPress={submit} disabled={!ready} accessibilityRole="button" style={[styles.submit, !ready && { opacity: 0.4 }]}>
          <Icon name="send" size={18} color={color.ink} strokeWidth={2.4} />
          <Text style={styles.buttonText}>Send for review</Text>
        </PressScale>
      </View>

      {stage === 'uploading' && (
        <Animated.View entering={FadeIn.duration(180)} style={styles.overlay}>
          <View style={styles.progressCard}>
            <View style={styles.ringWrap}>
              <Ring progress={step === 1 ? progress : step > 1 ? 1 : 0.02} size={96} stroke={7} />
              <Text style={styles.pct}>{step === 1 ? `${Math.round(progress * 100)}%` : step > 1 ? '100%' : '…'}</Text>
            </View>
            {STEPS.map((s, i) => (
              <View key={s} style={styles.stepRow}>
                <View style={[styles.stepDot, i < step && styles.stepDone, i === step && styles.stepNow]}>
                  {i < step && <Icon name="check" size={10} color={color.ink} strokeWidth={3.2} />}
                </View>
                <Text style={[styles.stepText, i > step && { color: color.text3 }]}>{s}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

function PickCard({ onPress }: { onPress: () => void }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Choose a video" style={styles.pick}>
      <View style={styles.pickIcon}>
        <Icon name="plus" size={28} color={color.ink} strokeWidth={2.6} />
      </View>
      <Text style={styles.pickTitle}>Choose a video</Text>
      <Text style={styles.pickSub}>Up to {MAX_SECONDS} seconds · 50 MB · portrait looks best</Text>
    </PressScale>
  );
}

function Preview({ picked, onChange }: { picked: Picked; onChange: () => void }) {
  const player = useVideoPlayer({ uri: picked.uri }, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={styles.preview}>
      <VideoView player={player} style={styles.previewVideo} contentFit="cover" nativeControls={false} />
      <View style={styles.previewMeta}>
        <Text style={styles.previewTime}>{Math.round(picked.seconds)}s</Text>
        <Pressable onPress={onChange} hitSlop={8} style={styles.change}>
          <Text style={styles.changeText}>Change</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  content: { paddingHorizontal: space.lg, gap: space.xl },
  pick: { height: 220, borderRadius: radius.card + 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.line, backgroundColor: color.surface1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  pickIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  pickTitle: { color: color.text, fontFamily: font.title, fontSize: 19 },
  pickSub: { color: color.text2, fontFamily: font.medium, fontSize: 13 },
  preview: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-end' },
  previewVideo: { width: 150, height: 266, borderRadius: radius.card, backgroundColor: color.surface1 },
  previewMeta: { gap: space.sm, paddingBottom: space.sm },
  previewTime: { color: color.text, fontFamily: font.mono, fontSize: 16 },
  change: { alignSelf: 'flex-start', paddingHorizontal: 14, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, justifyContent: 'center' },
  changeText: { color: color.text, fontFamily: font.semibold, fontSize: 13 },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: 14, backgroundColor: 'rgba(255,90,60,0.12)' },
  errorText: { flex: 1, color: '#FF8A73', fontFamily: font.medium, fontSize: 13 },
  fieldHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  fieldLabel: { color: color.text, fontFamily: font.bold, fontSize: 15 },
  fieldHint: { color: color.text3, fontFamily: font.medium, fontSize: 12 },
  input: { minHeight: 84, borderRadius: 14, backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line, padding: space.md, color: color.text, fontFamily: font.medium, fontSize: 15, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line },
  chipOn: { backgroundColor: color.text, borderColor: color.text },
  chipEmoji: { fontSize: 16 },
  chipText: { color: color.text, fontFamily: font.semibold, fontSize: 13 },
  lanes: { flexDirection: 'row', gap: space.sm },
  lane: { flex: 1, paddingVertical: space.md, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', gap: 2 },
  laneLabel: { fontFamily: font.bold, fontSize: 14 },
  laneAges: { color: color.text3, fontFamily: font.medium, fontSize: 11 },
  agree: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: color.text3, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: '#4FE3B0', borderColor: '#4FE3B0' },
  agreeText: { flex: 1, color: color.text2, fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.ink, borderTopWidth: 1, borderTopColor: color.surface2 },
  submit: { height: 54, borderRadius: radius.pill, backgroundColor: color.ember, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  button: { height: 50, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: color.ember, justifyContent: 'center' },
  secondary: { backgroundColor: color.surface2 },
  buttonText: { color: color.ink, fontFamily: font.bold, fontSize: 16 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,10,15,0.88)', alignItems: 'center', justifyContent: 'center' },
  progressCard: { width: 280, padding: space.xl, borderRadius: radius.card + 4, backgroundColor: color.surface1, gap: space.md },
  ringWrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  pct: { position: 'absolute', color: color.text, fontFamily: font.mono, fontSize: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  stepNow: { borderColor: color.ember },
  stepDone: { backgroundColor: '#4FE3B0', borderColor: '#4FE3B0' },
  stepText: { color: color.text, fontFamily: font.semibold, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.xl },
  doneBadge: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#4FE3B0', alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  doneTitle: { color: color.text, fontFamily: font.display, fontSize: 28, letterSpacing: -0.5 },
  doneSub: { color: color.text2, fontFamily: font.medium, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  doneRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
});
