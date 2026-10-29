import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon, IconName } from '@/components/Icon';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { PinPad } from '@/components/PinPad';
import { Avatar } from '@/components/ui/Avatar';
import { useFamily } from '@/features/family/FamilyProvider';
import { ChildSetup } from '@/features/onboarding/ChildSetup';
import { ConsentStep, useParentalConsent } from '@/features/onboarding/Consent';
import { ParentSessionProvider, useParentSession, withParent } from '@/features/onboarding/ParentSession';
import { Step } from '@/features/onboarding/Step';
import { laneKey, LANGS, TKey, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useInsets } from '@/lib/useInsets';
import { color, font, lane as lanes, pageFill, radius, space, themedStyles } from '@/theme/tokens';

type Stage = 'welcome' | 'pin' | 'pinConfirm' | 'you' | 'consent' | 'child' | 'family';

/**
 * A new family's first run. Collects the parent's name and PIN, then each
 * child's age, interests, learning mix and screen time — which decide their
 * lane, what their feed ranks first, and their limits. Picks up where it
 * left off if the app closes midway (PIN set → asks for it instead).
 */
export default function OnboardingScreen() {
  return (
    <ParentSessionProvider>
      <Flow />
    </ParentSessionProvider>
  );
}

function Flow() {
  const { t, lang } = useT();
  const { profiles, hasPin, plan, refresh } = useFamily();
  const gate = useParentSession();
  const consent = useParentalConsent();
  const [stage, setStage] = useState<Stage>('welcome');
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [parentName, setParentName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adult = profiles.find((p) => p.lane === 'adult');
  const kids = profiles.filter((p) => p.lane !== 'adult');

  /** A child's setup comes after the parental notice, until the family has agreed to it. */
  const toChild = () => setStage(consent.given ? 'child' : 'consent');
  /** After the PIN: the parent's own profile if there isn't one, then the first child, then the family. */
  const afterPin = () => (!adult ? setStage('you') : kids.length === 0 ? toChild() : setStage('family'));

  if (stage === 'welcome') return <Welcome onStart={() => setStage('pin')} />;

  if (stage === 'pin' || stage === 'pinConfirm') {
    const creating = !hasPin;
    return (
      <Step stepKey={stage} progress={0.12} onBack={() => (stage === 'pinConfirm' ? setStage('pin') : setStage('welcome'))}>
        <View style={styles.pinWrap}>
          <PinPad
            key={stage}
            title={!creating ? t('onboarding.pin.enter') : stage === 'pin' ? t('onboarding.pin.create') : t('onboarding.pin.confirm')}
            onComplete={async (pin) => {
              if (creating && stage === 'pin') {
                setFirstPin(pin);
                setStage('pinConfirm');
                return true;
              }
              if (creating) {
                if (pin !== firstPin) {
                  setStage('pin');
                  return t('onboarding.pin.mismatch');
                }
                const { data: ok, error: setErr } = await supabase.rpc('set_parent_pin', { p_new_pin: pin });
                if (setErr || !ok) return setErr?.message ?? false;
              }
              const { data: token, error: sessErr } = await supabase.rpc('start_parent_session', { p_pin: pin });
              if (sessErr) return sessErr.message;
              if (!token) return false;
              gate.adopt(token);
              await refresh();
              afterPin();
              return true;
            }}
          />
          <Text style={styles.pinWhy}>{t('onboarding.pin.why')}</Text>
        </View>
      </Step>
    );
  }

  if (stage === 'you') {
    const nm = parentName.trim();
    return (
      <Step
        stepKey="you"
        progress={0.25}
        title={t('onboarding.you.title')}
        hint={t('onboarding.you.hint')}
        action={{
          label: busy ? '…' : t('common.continue'),
          disabled: nm.length === 0 || busy,
          onPress: async () => {
            setBusy(true);
            setError(null);
            const res = await withParent(gate, (token) =>
              supabase.rpc('create_profile', { p_parent: token, p_name: nm, p_birth_month: null, p_language: lang, p_adult: true }),
            );
            setBusy(false);
            if (!res) return;
            if (res.error) return setError(t('onboarding.error.generic'));
            await refresh();
            if (kids.length === 0) toChild();
            else setStage('family');
          },
        }}
      >
        <TextInput
          style={styles.nameInput}
          placeholder={t('onboarding.you.placeholder')}
          placeholderTextColor={color.text3}
          value={parentName}
          onChangeText={setParentName}
          maxLength={30}
          autoFocus
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </Step>
    );
  }

  if (stage === 'consent') {
    return (
      <ConsentStep
        progress={0.28}
        onBack={() => setStage(kids.length > 0 || adult ? 'family' : 'you')}
        onAgreed={() => {
          consent.setGiven(true);
          setStage('child');
        }}
      />
    );
  }

  if (stage === 'child') {
    return (
      <ChildSetup
        progress={[0.3, 0.95]}
        onCancel={() => setStage(kids.length > 0 ? 'family' : adult ? 'family' : 'you')}
        onDone={async () => {
          await refresh();
          setStage('family');
        }}
      />
    );
  }

  // family: who's in, add another, finish
  return (
    <Step
      stepKey="family"
      progress={1}
      title={t('onboarding.review.title')}
      hint={t('onboarding.review.hint')}
      action={{
        label: busy ? '…' : t('onboarding.review.finish'),
        disabled: busy || profiles.length === 0,
        onPress: async () => {
          setBusy(true);
          const res = await withParent(gate, (token) => supabase.rpc('finish_onboarding', { p_parent: token, p_language: lang }));
          setBusy(false);
          if (!res || res.error) return fx.error();
          fx.success();
          await refresh(); // onboarded_at set → the router moves on to "Who's watching?"
        },
      }}
      secondary={profiles.length < (plan?.profile_limit ?? 6) ? { label: t('onboarding.review.addChild'), onPress: toChild } : undefined}
    >
      {plan && !plan.plus && profiles.length >= plan.profile_limit && <Text style={styles.planNote}>{t('plus.limitReached')}</Text>}
      {profiles.map((p, i) => {
        const L = lanes[p.lane];
        return (
          <Enter key={p.id} index={i}>
            <View style={styles.member}>
              <Avatar name={p.display_name} avatar={p.avatar} lane={p.lane} size={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {p.display_name}
                </Text>
                <Text style={styles.memberMeta} numberOfLines={1}>
                  {p.lane === 'adult'
                    ? t('onboarding.review.you')
                    : `${t(laneKey(p.lane))} · ${
                        p.daily_limit_minutes
                          ? t('onboarding.review.limit', { minutes: t('common.minutes', { count: p.daily_limit_minutes }) })
                          : t('onboarding.review.noLimit')
                      }`}
                </Text>
              </View>
              <Icon name="check" size={18} color={L.color} strokeWidth={2.6} />
            </View>
          </Enter>
        );
      })}
    </Step>
  );
}

const POINTS: { icon: IconName; key: TKey; tint: string }[] = [
  { icon: 'shield', key: 'onboarding.welcome.lanes', tint: color.success },
  { icon: 'sliders', key: 'onboarding.welcome.control', tint: color.info },
  { icon: 'sparkle', key: 'onboarding.welcome.learn', tint: color.reward },
];

function Welcome({ onStart }: { onStart: () => void }) {
  const { t, lang } = useT();
  const insets = useInsets();
  const [langOpen, setLangOpen] = useState(false);
  const native = useMemo(() => LANGS.find((l) => l.code === lang)?.native, [lang]);

  return (
    <View style={[styles.welcome, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.welcomeTop}>
        <PressScale onPress={() => setLangOpen(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('common.language')} style={styles.langChip}>
          <Icon name="discover" size={16} color={color.text2} strokeWidth={2.2} />
          <Text style={styles.langChipText}>{native}</Text>
        </PressScale>
      </View>

      <View style={styles.welcomeBody}>
        <Enter index={0}>
          <View style={styles.lanesRow}>
            {(['little', 'kids', 'teen', 'adult'] as const).map((l) => (
              <View key={l} style={[styles.laneBar, { backgroundColor: lanes[l].color }]} />
            ))}
          </View>
        </Enter>
        <Enter index={1}>
          <Text style={styles.welcomeTitle}>{t('onboarding.welcome.title')}</Text>
        </Enter>
        <Enter index={2}>
          <Text style={styles.welcomeSub}>{t('onboarding.welcome.body')}</Text>
        </Enter>
        <View style={{ gap: space.md, marginTop: space.lg }}>
          {POINTS.map((p, i) => (
            <Enter key={p.key} index={3 + i} style={styles.point}>
              <View style={[styles.pointIcon, { backgroundColor: p.tint + '22' }]}>
                <Icon name={p.icon} size={20} color={p.tint} strokeWidth={2.2} />
              </View>
              <Text style={styles.pointText}>{t(p.key)}</Text>
            </Enter>
          ))}
        </View>
      </View>

      <Enter index={7}>
        <PressScale
          onPress={() => {
            fx.tap();
            onStart();
          }}
          accessibilityRole="button"
          style={styles.start}
        >
          <Text style={styles.startText}>{t('onboarding.welcome.start')}</Text>
        </PressScale>
      </Enter>

      <BottomSheet open={langOpen} onClose={() => setLangOpen(false)} title={t('common.language')}>
        <View style={{ paddingHorizontal: space.xl }}>
          <LanguagePicker onPicked={() => setLangOpen(false)} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = themedStyles(() => ({
  pinWrap: { alignItems: 'center', gap: space.lg, paddingTop: space.xl },
  pinWhy: { color: color.text3, fontFamily: font.medium, fontSize: 13, textAlign: 'center' },
  nameInput: { color: color.text, fontFamily: font.display, fontSize: 32, paddingVertical: space.md, borderBottomWidth: 2, borderBottomColor: color.line },
  error: { color: color.ember, fontFamily: font.semibold, fontSize: 14 },
  planNote: { color: color.text3, fontFamily: font.medium, fontSize: 13, lineHeight: 18, marginBottom: space.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: color.surface1, borderWidth: 2, borderColor: color.line },
  memberName: { color: color.text, fontFamily: font.bold, fontSize: 17 },
  memberMeta: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  welcome: { flex: 1, ...pageFill(), paddingHorizontal: space.xl },
  welcomeTop: { flexDirection: 'row', justifyContent: 'flex-end' },
  langChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line },
  langChipText: { color: color.text, fontFamily: font.semibold, fontSize: 14 },
  welcomeBody: { flex: 1, justifyContent: 'center', gap: space.md },
  lanesRow: { flexDirection: 'row', gap: 6, marginBottom: space.lg },
  laneBar: { width: 36, height: 10, borderRadius: 5 },
  welcomeTitle: { color: color.text, fontFamily: font.display, fontSize: 38, lineHeight: 44, letterSpacing: -1 },
  welcomeSub: { color: color.text2, fontFamily: font.medium, fontSize: 17, lineHeight: 24 },
  point: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pointIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, color: color.text, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  start: { height: 58, borderRadius: radius.pill, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  startText: { color: color.ink, fontFamily: font.bold, fontSize: 17 },
}));
