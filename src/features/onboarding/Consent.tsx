import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Icon, IconName } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { TKey, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { color, font, size, space, themedStyles } from '@/theme/tokens';

import { useParentSession, withParent } from './ParentSession';
import { Step } from './Step';

/** The privacy notice a parent agrees to. Bump it when the policy changes, and every family is asked again. */
export const POLICY_VERSION = '2026-10-29';
/** The published privacy policy; until there is one, the notice shows without a link. */
const POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

/** Whether this family has agreed to the current notice (null while asking the server). */
export function useParentalConsent() {
  const [given, setGiven] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.rpc('has_parental_consent', { p_version: POLICY_VERSION }).then(({ data }) => setGiven(!!data));
  }, []);
  return { given, setGiven };
}

const POINTS: { icon: IconName; key: TKey; tint: string }[] = [
  { icon: 'save', key: 'onboarding.consent.collect', tint: color.info },
  { icon: 'sparkle', key: 'onboarding.consent.why', tint: color.reward },
  { icon: 'lock', key: 'onboarding.consent.who', tint: color.success },
  { icon: 'clock', key: 'onboarding.consent.howLong', tint: color.warning },
  { icon: 'sliders', key: 'onboarding.consent.rights', tint: color.text2 },
];

/**
 * The parental notice and consent, shown once before a family's first child
 * (and again after POLICY_VERSION changes). Needs an open parent session; the
 * server refuses child profiles until this is recorded.
 */
export function ConsentStep({ progress, onBack, onAgreed }: { progress: number; onBack: () => void; onAgreed: () => void }) {
  const { t, lang } = useT();
  const gate = useParentSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Step
      stepKey="consent"
      progress={progress}
      title={t('onboarding.consent.title')}
      hint={t('onboarding.consent.hint')}
      onBack={onBack}
      action={{
        label: busy ? '…' : t('onboarding.consent.agree'),
        disabled: busy,
        onPress: async () => {
          setBusy(true);
          setError(null);
          const res = await withParent(gate, (token) =>
            supabase.rpc('give_parental_consent', { p_parent: token, p_version: POLICY_VERSION, p_language: lang }),
          );
          setBusy(false);
          if (!res) return;
          if (res.error) return setError(t('onboarding.error.generic'));
          fx.success();
          onAgreed();
        },
      }}
    >
      <View style={{ gap: space.md }}>
        {POINTS.map((p, i) => (
          <Enter key={p.key} index={i} style={styles.point}>
            <View style={[styles.pointIcon, { backgroundColor: p.tint + '22' }]}>
              <Icon name={p.icon} size={18} color={p.tint} strokeWidth={2.2} />
            </View>
            <Text style={styles.pointText}>{t(p.key)}</Text>
          </Enter>
        ))}
      </View>
      {!!POLICY_URL && (
        <Pressable onPress={() => Linking.openURL(POLICY_URL)} accessibilityRole="link" hitSlop={8} style={styles.policy}>
          <Text style={styles.policyText}>{t('onboarding.consent.policy')}</Text>
        </Pressable>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </Step>
  );
}

const styles = themedStyles(() => ({
  point: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pointIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, color: color.text, fontFamily: font.medium, fontSize: size.small, lineHeight: 20 },
  policy: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center' },
  policyText: { color: color.text2, fontFamily: font.semibold, fontSize: size.small, textDecorationLine: 'underline' },
  error: { color: color.danger, fontFamily: font.semibold, fontSize: size.small },
}));
