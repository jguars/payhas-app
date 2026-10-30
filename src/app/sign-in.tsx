import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { SafeScreen } from '@/components/SafeScreen';
import { firstRun } from '@/features/start/firstRun';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { color, font, pageFill, radius, size, space, themedStyles } from '@/theme/tokens';

type Mode = 'signIn' | 'signUp';

export default function SignInScreen() {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>(firstRun.signUp ? 'signUp' : 'signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const creds = { email: email.trim(), password };
    const { data, error } =
      mode === 'signIn' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
    setBusy(false);
    if (error) {
      if (error.code === 'invalid_credentials') return setMessage(t('auth.invalidLogin'));
      if (error.code === 'user_already_exists') return setMessage(t('auth.alreadyRegistered'));
      return setMessage(error.message);
    }
    // With email confirmation on, sign-up returns no session until the link is clicked.
    if (mode === 'signUp' && !data.session) {
      setMode('signIn');
      setMessage(t('auth.checkEmail'));
    }
  };

  const canSubmit = email.includes('@') && password.length >= 8 && !busy;

  return (
    <SafeScreen style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        <Text style={styles.logo}>payhas</Text>
        <Text style={styles.subtitle}>{mode === 'signIn' ? t('auth.signInTitle') : t('auth.signUpTitle')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          placeholderTextColor={color.text3}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
          placeholderTextColor={color.text3}
          secureTextEntry
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => canSubmit && submit()}
        />

        <Text style={styles.message}>{message ?? ' '}</Text>

        <Pressable onPress={submit} disabled={!canSubmit} style={[styles.button, !canSubmit && styles.buttonOff]}>
          {busy ? (
            <ActivityIndicator color={color.ink} />
          ) : (
            <Text style={styles.buttonText}>{mode === 'signIn' ? t('auth.signIn') : t('auth.createAccount')}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')} hitSlop={10}>
          <Text style={styles.switch}>{mode === 'signIn' ? t('auth.toSignUp') : t('auth.toSignIn')}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl, gap: space.md },
  logo: { color: color.text, fontFamily: font.display, fontSize: size.hero, textAlign: 'center' },
  subtitle: { color: color.text2, fontFamily: font.medium, fontSize: size.body, textAlign: 'center', marginBottom: space.xl },
  input: {
    height: 52,
    borderRadius: radius.chip,
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.lg,
    color: color.text,
    fontFamily: font.medium,
    fontSize: size.body,
  },
  message: { color: color.text2, fontFamily: font.medium, fontSize: size.small, textAlign: 'center' },
  button: { height: 52, borderRadius: radius.pill, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: color.ink, fontFamily: font.bold, fontSize: size.body },
  switch: { color: color.text2, fontFamily: font.semibold, fontSize: size.small, textAlign: 'center', marginTop: space.sm },
}));
