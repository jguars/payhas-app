import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { color, font, radius, size, space, themedStyles } from '@/theme/tokens';

import { Bank, BANKS, payByCard, planDate } from './plan';

/** The sample card "Fill sample card" types in while test mode is on. */
const SAMPLE = { number: '4111 1111 1111 1111', expiry: '12/28', name: 'TEST CARD', cvc: '123' };

const digits = (s: string) => s.replace(/\D/g, '');
const groupNumber = (s: string) => (digits(s).slice(0, 16).match(/.{1,4}/g) ?? []).join(' ');
const groupExpiry = (s: string) => {
  const d = digits(s).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/**
 * Pay a month of Plus by card through Halkbank, Senagat Bank or Rysgal Bank.
 * For now it's a simulation (test mode): the form checks the card's shape,
 * but only the chosen bank goes to the server — card details stay here.
 * `run` supplies a parent session, asking for the PIN again if it ran out.
 */
export function CardPayment({
  price,
  testMode,
  run,
  onPaid,
}: {
  price: number;
  testMode: boolean;
  run: <T>(call: (token: string) => Promise<T | null>) => Promise<T | null>;
  onPaid: (text: string) => void;
}) {
  const { t } = useT();
  const [bank, setBank] = useState<Bank | null>(null);
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [name, setName] = useState('');
  const [cvc, setCvc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const month = Number(expiry.slice(0, 2));
  const ready = !!bank && digits(number).length === 16 && /^\d{2}\/\d{2}$/.test(expiry) && month >= 1 && month <= 12 && name.trim().length > 1 && /^\d{3}$/.test(cvc);

  const pay = async () => {
    if (!bank) return;
    setBusy(true);
    setError(null);
    const res = await run((token) => payByCard(token, bank));
    setBusy(false);
    if (res?.result === 'ok' && res.plus_until) {
      fx.success();
      setNumber('');
      setExpiry('');
      setName('');
      setCvc('');
      onPaid(t('plus.cardDone', { bank: BANKS.find((b) => b.id === bank)!.name, date: planDate(res.plus_until) }));
      return;
    }
    fx.error();
    setError(t('plus.cardFailed'));
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('plus.cardTitle')}</Text>

      <Text style={styles.label}>{t('plus.cardPick')}</Text>
      <View style={styles.banks}>
        {BANKS.map((b) => {
          const on = bank === b.id;
          return (
            <PressScale
              key={b.id}
              onPress={() => {
                fx.tap();
                setBank(b.id);
                setError(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.bank, on && styles.bankOn]}
            >
              <Text style={[styles.bankText, on && { color: color.text }]} numberOfLines={1}>
                {b.name}
              </Text>
            </PressScale>
          );
        })}
      </View>

      <TextInput
        value={number}
        onChangeText={(v) => setNumber(groupNumber(v))}
        placeholder={t('plus.cardNumber')}
        placeholderTextColor={color.text3}
        keyboardType="number-pad"
        autoComplete="off"
        maxLength={19}
        style={[styles.input, styles.mono]}
        accessibilityLabel={t('plus.cardNumber')}
      />
      <View style={styles.pair}>
        <TextInput
          value={expiry}
          onChangeText={(v) => setExpiry(groupExpiry(v))}
          placeholder={t('plus.cardExpiry')}
          placeholderTextColor={color.text3}
          keyboardType="number-pad"
          autoComplete="off"
          maxLength={5}
          style={[styles.input, styles.mono, { flex: 1 }]}
          accessibilityLabel={t('plus.cardExpiry')}
        />
        <TextInput
          value={cvc}
          onChangeText={(v) => setCvc(digits(v).slice(0, 3))}
          placeholder={t('plus.cardCvc')}
          placeholderTextColor={color.text3}
          keyboardType="number-pad"
          autoComplete="off"
          secureTextEntry
          maxLength={3}
          style={[styles.input, styles.mono, { flex: 1 }]}
          accessibilityLabel={t('plus.cardCvc')}
        />
      </View>
      <TextInput
        value={name}
        onChangeText={(v) => setName(v.toUpperCase())}
        placeholder={t('plus.cardName')}
        placeholderTextColor={color.text3}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={40}
        style={styles.input}
        accessibilityLabel={t('plus.cardName')}
      />

      {testMode && (
        <PressScale
          onPress={() => {
            fx.tap();
            setBank((b) => b ?? 'halkbank');
            setNumber(SAMPLE.number);
            setExpiry(SAMPLE.expiry);
            setName(SAMPLE.name);
            setCvc(SAMPLE.cvc);
            setError(null);
          }}
          accessibilityRole="button"
          style={styles.sample}
        >
          <Icon name="sparkle" size={16} color={color.text2} strokeWidth={2.2} />
          <Text style={styles.sampleText}>{t('plus.cardSample')}</Text>
        </PressScale>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
      <PressScale
        onPress={pay}
        disabled={!ready || busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready || busy }}
        style={[styles.pay, (!ready || busy) && styles.payOff]}
      >
        <Icon name="lock" size={18} color={color.ink} strokeWidth={2.4} />
        <Text style={styles.payText}>{busy ? '…' : t('plus.cardPay', { price })}</Text>
      </PressScale>
      {testMode && <Text style={styles.note}>{t('plus.cardTestNote')}</Text>}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { gap: space.md },
  title: { color: color.text, fontFamily: font.title, fontSize: size.lead },
  label: { color: color.text2, fontFamily: font.semibold, fontSize: size.small },
  banks: { flexDirection: 'row', gap: space.sm },
  bank: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderRadius: radius.chip, borderWidth: 1.5, borderColor: color.line, backgroundColor: color.bg },
  bankOn: { borderColor: color.ember, backgroundColor: color.surface2 },
  bankText: { color: color.text2, fontFamily: font.bold, fontSize: size.small },
  input: { color: color.text, fontFamily: font.semibold, fontSize: size.body, minHeight: 52, paddingHorizontal: space.md, borderRadius: 14, backgroundColor: color.bg, borderWidth: 1.5, borderColor: color.line },
  mono: { fontFamily: font.mono, letterSpacing: 1 },
  pair: { flexDirection: 'row', gap: space.sm },
  sample: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: radius.pill, backgroundColor: color.surface2 },
  sampleText: { color: color.text, fontFamily: font.semibold, fontSize: size.small },
  error: { color: color.danger, fontFamily: font.semibold, fontSize: size.small, textAlign: 'center' },
  pay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 52, borderRadius: radius.pill, backgroundColor: color.ember },
  payOff: { opacity: 0.4 },
  payText: { color: color.ink, fontFamily: font.bold, fontSize: size.body },
  note: { color: color.text3, fontFamily: font.medium, fontSize: size.caption, lineHeight: 17, textAlign: 'center' },
}));
