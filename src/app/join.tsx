import * as Device from 'expo-device';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { SafeScreen } from '@/components/SafeScreen';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useFamily } from '@/features/family/FamilyProvider';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { border, color, control, font, layout, pageFill, radius, space, themedStyles, type } from '@/theme/tokens';

const CODE_LENGTH = 6;
/** How often a waiting phone asks whether the parent has allowed it. */
const POLL_MS = 3000;

/**
 * "Join my family" on a member's own phone (or a co-parent joining with their own number). The code from the parent's
 * dashboard (join-family edge function) makes this phone its own user in the
 * family — never the parent's login — and then it waits here until the parent
 * taps Allow. Allowed, the family provider takes over: a child's phone opens
 * straight into that child, a shared phone shows "Who's watching?".
 */
export default function JoinScreen() {
  const { session, device } = useFamily();
  const { t } = useT();
  return (
    <SafeScreen style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.logo}>payhas</Text>
          <Text style={styles.title}>{t('auth.joinFamily')}</Text>
          {session && device?.status === 'pending' ? <Waiting parent={device.parent_name} /> : <EnterCode />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

function EnterCode() {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A co-parent invite: the code is right, and their own number comes next.
  const [asParent, setAsParent] = useState(false);
  const [digits, setDigits] = useState('');
  const [otp, setOtp] = useState('');

  const join = async (value: string, phone?: { number: string; otp: string }) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const name = Device.modelName ?? (Platform.OS === 'ios' ? 'iPhone' : 'Android phone');
    const body = phone ? { code: value, name, phone: phone.number, otp: phone.otp } : { code: value, name };
    const { data, error: fnError } = await supabase.functions.invoke('join-family', { body });
    if (fnError || !data?.email) {
      setBusy(false);
      // A non-2xx reply carries the reason in its body.
      const reason = fnError && 'context' in fnError ? await (fnError.context as Response).json().then((b) => b?.error).catch(() => null) : null;
      if (reason === 'needs_phone') return setAsParent(true);
      fx.error();
      if (reason === 'bad_otp') {
        setOtp('');
        return setError(t('auth.wrongCode'));
      }
      if (!phone) setCode('');
      return setError(
        t(
          reason === 'too_many'
            ? 'auth.joinTooMany'
            : reason === 'bad_code'
              ? 'auth.joinWrong'
              : reason === 'phone_taken'
                ? 'auth.phoneTaken'
                : reason === 'phone_off'
                  ? 'auth.phoneOff'
                  : 'auth.connectionError',
        ),
      );
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
    setBusy(false);
    if (signInError) setError(t('auth.connectionError'));
    // Signed in: the family provider sees a pending phone and this screen switches to waiting.
  };

  if (asParent) {
    const ready = digits.length === 8 && otp.length === 4;
    return (
      <View style={styles.form}>
        <Text style={styles.stepTitle}>{t('auth.joinPhoneTitle')}</Text>
        <Text style={styles.stepSub}>{t('auth.joinPhoneSub')}</Text>
        <View style={styles.phoneRow}>
          <View style={styles.country}>
            <Text style={styles.countryText}>+993</Text>
          </View>
          <View style={styles.grow}>
            <TextField
              value={digits}
              onChangeText={(v) => setDigits(v.replace(/\D/g, '').slice(0, 8))}
              placeholder="61234567"
              keyboardType="number-pad"
              autoComplete="tel-national"
              maxLength={8}
              accessibilityLabel={`${t('auth.phoneLabel')}, +993`}
            />
          </View>
        </View>
        <TextField
          code
          label={t('auth.codeLabel')}
          hint={t('auth.codeHint', { phone: `+993 ${digits}` })}
          error={error}
          value={otp}
          onChangeText={(v) => {
            setOtp(v.replace(/\D/g, '').slice(0, 4));
            setError(null);
          }}
          placeholder="0000"
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={4}
        />
        <Button label={t('auth.continue')} loading={busy} disabled={!ready} onPress={() => join(code, { number: `+993${digits}`, otp })} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <TextField
        code
        autoFocus
        label={t('auth.joinCodeLabel')}
        hint={t('auth.joinSub')}
        error={error}
        value={code}
        onChangeText={(v) => {
          const next = v.replace(/\D/g, '').slice(0, CODE_LENGTH);
          setCode(next);
          setError(null);
          // The last digit sends it.
          if (next.length === CODE_LENGTH) join(next);
        }}
        placeholder="000000"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={CODE_LENGTH}
      />
      <Button label={t('auth.continue')} loading={busy} disabled={code.length !== CODE_LENGTH} onPress={() => join(code)} />
      <Button variant="quiet" label={t('auth.toSignIn')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))} />
    </View>
  );
}

/** Joined; asking the parent. Checks every few seconds; "Use a different code" starts over. */
function Waiting({ parent }: { parent: string | null }) {
  const { refresh, signOut } = useFamily();
  const { t } = useT();
  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);
  return (
    <View style={styles.form}>
      <View style={styles.waiting} accessibilityLiveRegion="polite">
        <ActivityIndicator color={color.text2} />
        <Text style={styles.waitTitle}>{t('auth.joinWaitTitle')}</Text>
        <Text style={styles.waitBody}>{t('auth.joinWait', { name: parent ?? t('auth.joinWaitParent') })}</Text>
      </View>
      <Button variant="quiet" label={t('auth.joinCancel')} onPress={signOut} />
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  flex: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: layout.gutter + space.sm, paddingVertical: space.xl, gap: space.md },
  logo: { color: color.text, fontFamily: font.display, ...type.hero, textAlign: 'center' },
  title: { color: color.text2, fontFamily: font.medium, ...type.body, textAlign: 'center', marginBottom: space.lg },
  form: { gap: space.md },
  stepTitle: { color: color.text, fontFamily: font.title, ...type.title },
  stepSub: { color: color.text2, fontFamily: font.medium, ...type.body },
  phoneRow: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
  grow: { flex: 1 },
  country: {
    minHeight: control.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    borderWidth: border.hairline,
    borderColor: color.line,
    backgroundColor: color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryText: { color: color.text, fontFamily: font.semibold, ...type.body },
  waiting: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  waitTitle: { color: color.text, fontFamily: font.title, ...type.title, textAlign: 'center' },
  waitBody: { color: color.text2, fontFamily: font.medium, ...type.body, textAlign: 'center' },
}));
