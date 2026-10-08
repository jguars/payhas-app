import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon, IconName } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { useToast } from '@/components/Toast';
import { Profile, useFamily } from '@/features/family/FamilyProvider';
import { ReportReason, useLibrary } from '@/features/library/LibraryProvider';
import { Constants } from '@/lib/database.types';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { spring } from '@/theme/motion';
import { color, font, Lane, lane as lanes, radius, space } from '@/theme/tokens';

import { FeedVideo, formatCount } from './data';

export type SheetMode = 'share' | 'options';
type Step = 'main' | 'why' | 'report';

const rank = (l: Lane) => Constants.public.Enums.lane.indexOf(l);
/** Mirrors the lane rule of the server gate; the server re-checks on send. */
const allowedFor = (video: FeedVideo, p: Profile) => rank(video.lane) <= rank(p.lane);

const REPORT_REASONS: { reason: ReportReason; label: string; icon: IconName }[] = [
  { reason: 'scary', label: "It's scary or upsetting", icon: 'eyeOff' },
  { reason: 'not_my_age', label: "It's not right for my age", icon: 'shield' },
  { reason: 'mean', label: 'Someone is being mean', icon: 'flag' },
  { reason: 'other', label: 'Something else is wrong', icon: 'help' },
];

type Props = { video: FeedVideo | null; mode: SheetMode; onClose: () => void };

export function VideoSheet({ video, mode, onClose }: Props) {
  const [step, setStep] = useState<Step>('main');
  useEffect(() => {
    if (video) setStep('main');
  }, [video]);

  const title = step === 'why' ? 'Why you’re seeing this' : step === 'report' ? 'What’s wrong with it?' : mode === 'share' ? 'Send to' : undefined;

  return (
    <BottomSheet open={!!video} onClose={onClose} title={title}>
      {video && step === 'main' && <Main video={video} mode={mode} onClose={onClose} onStep={setStep} />}
      {video && step === 'why' && <Why video={video} onBack={() => setStep('main')} />}
      {video && step === 'report' && <Report video={video} onClose={onClose} onBack={() => setStep('main')} />}
    </BottomSheet>
  );
}

function Main({ video, mode, onClose, onStep }: { video: FeedVideo; mode: SheetMode; onClose: () => void; onStep: (s: Step) => void }) {
  const { profiles, current } = useFamily();
  const { saved, toggleSave, hide, sendToFamily, logExternalShare } = useLibrary();
  const toast = useToast();
  const family = profiles.filter((p) => p.id !== current?.id);
  const canShareOut = current?.lane === 'teen' || current?.lane === 'adult';
  const isSaved = saved.has(video.id);

  const shareOut = async () => {
    // payhas:// opens the app on the recipient's phone; there's no web player yet.
    const result = await Share.share({ message: `${video.caption} — on Payhas\npayhas:///?v=${video.id}` });
    if (result.action === Share.sharedAction) logExternalShare(video.id);
  };

  return (
    <View style={{ gap: space.lg }}>
      {mode === 'share' && (
        <>
          {family.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
              {family.map((p) => (
                <FamilyTarget key={p.id} profile={p} allowed={allowedFor(video, p)} onSend={() => sendToFamily(video.id, p.id)} />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.hint}>Add family profiles to send videos to each other.</Text>
          )}
          {canShareOut && (
            <View style={styles.outRow}>
              <PressScale onPress={() => {
                fx.tap();
                shareOut();
              }} accessibilityRole="button" style={styles.outButton}>
                <Icon name="send" size={18} color={color.ink} strokeWidth={2.4} />
                <Text style={styles.outText}>Share to apps</Text>
              </PressScale>
            </View>
          )}
          <View style={styles.divider} />
        </>
      )}

      <View style={styles.actions}>
        <Action
          icon="save"
          filled={isSaved}
          label={isSaved ? 'Saved' : 'Save'}
          onPress={() => {
            toggleSave(video.id);
            if (isSaved) fx.tap();
            else fx.save();
            if (!isSaved) toast({ text: 'Saved', icon: 'save', action: { label: 'View', onPress: () => router.push('/saved') } });
          }}
        />
        <Action
          icon="eyeOff"
          label="Not for me"
          onPress={() => {
            hide(video.id);
            fx.hide();
            onClose();
            toast({ text: 'Got it — you’ll see less like this', icon: 'check' });
          }}
        />
        <Action icon="help" label="Why this?" onPress={() => {
            fx.tap();
            onStep('why');
          }} />
        <Action icon="flag" label="Report" tone="warn" onPress={() => {
            fx.tap();
            onStep('report');
          }} />
      </View>
    </View>
  );
}

/** A family member's avatar; tap to send. Greyed with a lock when the video isn't allowed in their lane. */
function FamilyTarget({ profile, allowed, onSend }: { profile: Profile; allowed: boolean; onSend: () => Promise<boolean> }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'refused'>('idle');
  const pop = useSharedValue(1);
  const l = lanes[profile.lane];
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const press = async () => {
    if (!allowed || state !== 'idle') return;
    setState('sending');
    pop.value = withSequence(withTiming(0.88, { duration: 90 }), withSpring(1, spring.bouncy));
    const ok = await onSend();
    if (ok) fx.send();
    else fx.error();
    setState(ok ? 'sent' : 'refused');
  };

  return (
    <Pressable onPress={press} disabled={!allowed} accessibilityRole="button" accessibilityLabel={allowed ? `Send to ${profile.display_name}` : `${profile.display_name} can't watch this one`} style={styles.target}>
      <Animated.View style={[styles.targetAvatar, { backgroundColor: l.color }, !allowed && styles.targetOff, anim]}>
        <Text style={styles.targetLetter}>{profile.display_name[0]?.toUpperCase()}</Text>
        {(state === 'sent' || !allowed) && (
          <Animated.View entering={FadeIn.duration(160)} style={[styles.targetBadge, !allowed && { backgroundColor: color.surface2 }]}>
            <Icon name={allowed ? 'check' : 'lock'} size={12} color={allowed ? color.ink : color.text2} strokeWidth={3} />
          </Animated.View>
        )}
      </Animated.View>
      <Text style={[styles.targetName, !allowed && { color: color.text3 }]} numberOfLines={1}>
        {state === 'sent' ? 'Sent' : state === 'refused' ? 'Not allowed' : profile.display_name}
      </Text>
    </Pressable>
  );
}

function Action({ icon, label, onPress, filled, tone }: { icon: IconName; label: string; onPress: () => void; filled?: boolean; tone?: 'warn' }) {
  const tint = tone === 'warn' ? '#FF8A73' : color.text;
  return (
    <PressScale onPress={onPress} pressedScale={0.92} accessibilityRole="button" accessibilityLabel={label} style={styles.action}>
      <View style={styles.actionIcon}>
        <Icon name={icon} size={22} color={tint} filled={filled} strokeWidth={2} />
      </View>
      <Text style={[styles.actionLabel, tone === 'warn' && { color: tint }]}>{label}</Text>
    </PressScale>
  );
}

/** Plain-language reasons, built from what we actually know about this profile. */
function Why({ video, onBack }: { video: FeedVideo; onBack: () => void }) {
  const { current } = useFamily();
  const { following } = useLibrary();
  const [picked, setPicked] = useState<{ slug: string; label: string }[]>([]);

  useEffect(() => {
    if (!current) return;
    supabase
      .from('profile_interests')
      .select('interest_slug, interests(label)')
      .eq('profile_id', current.id)
      .then(({ data }) =>
        setPicked((data ?? []).map((r) => ({ slug: r.interest_slug, label: (r.interests as { label: string } | null)?.label ?? r.interest_slug }))),
      );
  }, [current]);

  const reasons: { icon: IconName; text: string }[] = [];
  if (following.has(video.creator.name)) reasons.push({ icon: 'check', text: `You follow ${video.creator.name}` });
  for (const p of picked.filter((p) => video.topics.includes(p.slug))) reasons.push({ icon: 'star', text: `You like ${p.label}` });
  if (current) reasons.push({ icon: 'shield', text: `Checked and allowed for the ${lanes[current.lane].label} lane` });
  reasons.push({ icon: 'play', text: `${formatCount(video.views)} views` });

  return (
    <View style={{ gap: space.md, paddingHorizontal: space.xl }}>
      {reasons.map((r, i) => (
        <Animated.View key={r.text} entering={FadeIn.delay(i * 60).duration(200)} style={styles.reason}>
          <View style={styles.reasonIcon}>
            <Icon name={r.icon} size={16} color={color.text} filled={r.icon === 'star'} strokeWidth={2.4} />
          </View>
          <Text style={styles.reasonText}>{r.text}</Text>
        </Animated.View>
      ))}
      <BackLink onPress={onBack} />
    </View>
  );
}

function Report({ video, onClose, onBack }: { video: FeedVideo; onClose: () => void; onBack: () => void }) {
  const { report } = useLibrary();
  const toast = useToast();
  return (
    <View style={{ gap: space.sm, paddingHorizontal: space.xl }}>
      {REPORT_REASONS.map((r, i) => (
        <Animated.View key={r.reason} entering={FadeIn.delay(i * 50).duration(180)}>
          <PressScale
            onPress={() => {
              report(video.id, r.reason);
              fx.success();
              onClose();
              toast({ text: 'Thanks for telling us. A grown-up will check it.', icon: 'check' });
            }}
            pressedScale={0.97}
            accessibilityRole="button"
            style={styles.reportRow}
          >
            <Icon name={r.icon} size={20} color={color.text2} />
            <Text style={styles.reportText}>{r.label}</Text>
            <Icon name="chevron" size={16} color={color.text3} strokeWidth={2.4} />
          </PressScale>
        </Animated.View>
      ))}
      <BackLink onPress={onBack} />
    </View>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.back} accessibilityRole="button">
      <Icon name="back" size={16} color={color.text2} strokeWidth={2.4} />
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  people: { paddingHorizontal: space.xl, gap: space.lg },
  hint: { color: color.text3, fontFamily: font.medium, fontSize: 14, textAlign: 'center', paddingHorizontal: space.xl },
  target: { width: 64, alignItems: 'center', gap: 6 },
  targetAvatar: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  targetOff: { opacity: 0.35 },
  targetLetter: { color: color.ink, fontFamily: font.display, fontSize: 24 },
  targetBadge: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#4FE3B0', borderWidth: 2, borderColor: color.surface1, alignItems: 'center', justifyContent: 'center' },
  targetName: { color: color.text, fontFamily: font.semibold, fontSize: 12 },
  outRow: { paddingHorizontal: space.xl },
  outButton: { height: 48, borderRadius: radius.pill, backgroundColor: color.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  outText: { color: color.ink, fontFamily: font.bold, fontSize: 15 },
  divider: { height: 1, backgroundColor: color.line, marginHorizontal: space.xl },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xl },
  action: { width: 72, alignItems: 'center', gap: 6 },
  actionIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: color.text, fontFamily: font.semibold, fontSize: 12 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  reasonIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  reasonText: { color: color.text, fontFamily: font.medium, fontSize: 15, flex: 1 },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 54, paddingHorizontal: space.lg, borderRadius: 16, backgroundColor: color.surface2 },
  reportText: { flex: 1, color: color.text, fontFamily: font.semibold, fontSize: 15 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 4, paddingVertical: space.sm },
  backText: { color: color.text2, fontFamily: font.semibold, fontSize: 14 },
});
