import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { SafeScreen } from '@/components/SafeScreen';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { TextField } from '@/components/ui/TextField';
import { firstRun } from '@/features/start/firstRun';
import { useBackToLanguage } from '@/features/start/useBackToLanguage';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { border, color, control, font, layout, pageFill, radius, space, themedStyles, type } from '@/theme/tokens';

type Method = 'phone' | 'email';
type Mode = 'signIn' | 'signUp';

/** Turkmenistan only for now: the country code is fixed and the number is 8 digits. */
const COUNTRY = '+993';
const DIGITS = 8;
const CODE_LENGTH = 4;

/** "+993 61 23 45 67" — read back on the code step. */
const spaced = (digits: string) => `${COUNTRY} ${digits.replace(/(\d{2})(?=\d)/g, '$1 ')}`;

/**
 * Parent sign-in. Phone is the main way in: the number, then a code, and the
 * same two steps either register a new family or sign an existing one back
 * in (the `phone-auth` edge function decides). While there's no SMS, the code
 * is the server's test code (0000). Email and password stay as the second
 * option, one tap away.
 */
export default function SignInScreen() {
  const { t } = useT();
  const [method, setMethod] = useState<Method>('phone');
  const [message, setMessage] = useState<string | null>(null);
  const backToLanguage = useBackToLanguage();
  // "Join my family" on Welcome: past the language step, on to the code. Back returns here.
  useEffect(() => {
    if (!firstRun.join) return;
    firstRun.join = false;
    firstRun.joinedFromWelcome = true;
    router.push('/join');
  }, []);

  return (
    <SafeScreen style={styles.root}>
      <View style={styles.back}>
        <IconButton icon="back" label={t('common.back')} onPress={backToLanguage} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.logo}>payhas</Text>
          {/* Get started reads as a new account, I have an account as signing in; the email form titles itself. */}
          {method === 'phone' && <Text style={styles.title}>{t(firstRun.signUp ? 'auth.signUpTitle' : 'auth.signInTitle')}</Text>}

          {method === 'phone' ? <PhoneForm onMessage={setMessage} /> : <EmailForm onMessage={setMessage} />}

          <Text style={styles.message} accessibilityLiveRegion="polite">
            {message ?? ' '}
          </Text>

          {/* A child's or a shared phone joins the parent's family with a code instead of signing in. */}
          <Button variant="secondary" icon="link" label={t('auth.joinFamily')} onPress={() => router.push('/join')} />
          <Button
            variant="quiet"
            label={method === 'phone' ? t('auth.useEmail') : t('auth.usePhone')}
            onPress={() => {
              setMessage(null);
              setMethod(method === 'phone' ? 'email' : 'phone');
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

/** Number, then code. A wrong code keeps the number; "Change number" goes back. */
function PhoneForm({ onMessage }: { onMessage: (m: string | null) => void }) {
  const { t } = useT();
  const [step, setStep] = useState<'number' | 'code'>('number');
  const [digits, setDigits] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const verify = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setCodeError(null);
    onMessage(null);
    const { data, error } = await supabase.functions.invoke('phone-auth', { body: { phone: COUNTRY + digits, code: value } });
    if (error || !data?.email) {
      setBusy(false);
      // A non-2xx reply carries the reason in its body.
      const reason = error && 'context' in error ? await (error.context as Response).json().then((b) => b?.error).catch(() => null) : null;
      if (reason === 'bad_code') {
        setCode('');
        return setCodeError(t('auth.wrongCode'));
      }
      return onMessage(t(reason === 'disabled' ? 'auth.phoneOff' : 'auth.connectionError'));
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
    setBusy(false);
    // Signed in: the family provider takes it from here (onboarding or "Who's watching?").
    if (signInError) onMessage(t('auth.connectionError'));
  };

  if (step === 'number') {
    const ready = digits.length === DIGITS;
    return (
      <View style={styles.form}>
        <Text style={styles.label}>{t('auth.phoneLabel')}</Text>
        <View style={styles.phoneRow}>
          <View style={styles.country} accessible accessibilityLabel={COUNTRY}>
            <Text style={styles.countryText}>{COUNTRY}</Text>
          </View>
          <View style={styles.flex}>
            <TextField
              value={digits}
              onChangeText={(v) => setDigits(v.replace(/\D/g, '').slice(0, DIGITS))}
              placeholder="61234567"
              keyboardType="number-pad"
              autoComplete="tel-national"
              textContentType="telephoneNumber"
              maxLength={DIGITS}
              accessibilityLabel={`${t('auth.phoneLabel')}, ${COUNTRY}`}
              onSubmitEditing={() => ready && setStep('code')}
            />
          </View>
        </View>
        <Text style={styles.hint}>{t('auth.phoneHint')}</Text>
        <Button
          label={t('auth.getCode')}
          disabled={!ready}
          onPress={() => {
            onMessage(null);
            setStep('code');
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.stepTitle}>{t('auth.codeTitle')}</Text>
      <TextField
        code
        autoFocus
        label={t('auth.codeLabel')}
        hint={t('auth.codeHint', { phone: spaced(digits) })}
        error={codeError}
        value={code}
        onChangeText={(v) => {
          const next = v.replace(/\D/g, '').slice(0, CODE_LENGTH);
          setCode(next);
          setCodeError(null);
          // The last digit sends it: no extra tap.
          if (next.length === CODE_LENGTH) verify(next);
        }}
        placeholder="0000"
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={CODE_LENGTH}
      />
      <Button label={t('auth.continue')} loading={busy} disabled={code.length !== CODE_LENGTH} onPress={() => verify(code)} />
      <Button
        variant="quiet"
        label={t('auth.changeNumber')}
        onPress={() => {
          setCode('');
          setCodeError(null);
          setStep('number');
        }}
      />
    </View>
  );
}

/** The second option: email and password, sign in or create an account. */
function EmailForm({ onMessage }: { onMessage: (m: string | null) => void }) {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>(firstRun.signUp ? 'signUp' : 'signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    onMessage(null);
    const creds = { email: email.trim(), password };
    const { data, error } = mode === 'signIn' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
    setBusy(false);
    if (error) {
      if (error.code === 'invalid_credentials') return onMessage(t('auth.invalidLogin'));
      if (error.code === 'user_already_exists') return onMessage(t('auth.alreadyRegistered'));
      return onMessage(error.message);
    }
    // With email confirmation on, sign-up returns no session until the link is clicked.
    if (mode === 'signUp' && !data.session) {
      setMode('signIn');
      onMessage(t('auth.checkEmail'));
    }
  };

  const canSubmit = email.includes('@') && password.length >= 8 && !busy;

  return (
    <View style={styles.form}>
      <Text style={styles.stepTitle}>{mode === 'signIn' ? t('auth.signIn') : t('auth.signUpTitle')}</Text>
      <TextField placeholder={t('auth.email')} accessibilityLabel={t('auth.email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextField
        placeholder={t('auth.password')}
        accessibilityLabel={t('auth.password')}
        secureTextEntry
        autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => canSubmit && submit()}
      />
      <Button testID="sign-in-submit" label={mode === 'signIn' ? t('auth.signIn') : t('auth.createAccount')} loading={busy} disabled={!canSubmit} onPress={submit} />
      <Button
        variant="quiet"
        label={mode === 'signIn' ? t('auth.toSignUp') : t('auth.toSignIn')}
        onPress={() => {
          onMessage(null);
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
        }}
      />
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  flex: { flex: 1 },
  back: { alignSelf: 'flex-start', marginLeft: layout.gutter - space.md, marginTop: space.sm },
  body: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: layout.gutter + space.sm, paddingVertical: space.xl, gap: space.md },
  logo: { color: color.text, fontFamily: font.display, ...type.hero, textAlign: 'center' },
  title: { color: color.text2, fontFamily: font.medium, ...type.body, textAlign: 'center', marginBottom: space.lg },
  form: { gap: space.md },
  stepTitle: { color: color.text, fontFamily: font.title, ...type.title },
  label: { color: color.text, fontFamily: font.semibold, ...type.small },
  hint: { color: color.text3, fontFamily: font.medium, ...type.small, marginTop: -space.xs },
  phoneRow: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
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
  message: { color: color.text2, fontFamily: font.medium, ...type.small, textAlign: 'center' },
}));
