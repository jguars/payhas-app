import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SafeScreen } from '@/components/SafeScreen';
import { supabase } from '@/lib/supabase';
import { color, font, radius, space } from '@/theme/tokens';

type Mode = 'signIn' | 'signUp';

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
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
    if (error) return setMessage(error.message);
    // With email confirmation on, sign-up returns no session until the link is clicked.
    if (mode === 'signUp' && !data.session) {
      setMode('signIn');
      setMessage('Check your email to confirm, then sign in.');
    }
  };

  const canSubmit = email.includes('@') && password.length >= 8 && !busy;

  return (
    <SafeScreen style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        <Text style={styles.logo}>payhas</Text>
        <Text style={styles.subtitle}>{mode === 'signIn' ? 'Parent sign in' : 'Create a family account'}</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={color.text3}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (8+ characters)"
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
            <Text style={styles.buttonText}>{mode === 'signIn' ? 'Sign in' : 'Create account'}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')} hitSlop={10}>
          <Text style={styles.switch}>{mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl, gap: space.md },
  logo: { color: color.text, fontFamily: font.display, fontSize: 44, textAlign: 'center' },
  subtitle: { color: color.text2, fontFamily: font.medium, fontSize: 16, textAlign: 'center', marginBottom: space.xl },
  input: {
    height: 52,
    borderRadius: radius.chip,
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.lg,
    color: color.text,
    fontFamily: font.medium,
    fontSize: 16,
  },
  message: { color: color.text2, fontFamily: font.medium, fontSize: 14, textAlign: 'center' },
  button: { height: 52, borderRadius: radius.pill, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: color.ink, fontFamily: font.bold, fontSize: 16 },
  switch: { color: color.text2, fontFamily: font.semibold, fontSize: 14, textAlign: 'center', marginTop: space.sm },
});
