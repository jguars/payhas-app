import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { useFamily } from '@/features/family/FamilyProvider';
import { ParentSessionProvider, useParentSession } from '@/features/onboarding/ParentSession';
import { currentParentToken } from '@/features/parent/useParent';
import { CardPayment } from '@/features/plan/CardPayment';
import { applyTestKey, formatCode, planDate, redeemCode } from '@/features/plan/plan';
import { TKey, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { useInsets } from '@/lib/useInsets';
import { useGoBack } from '@/lib/useGoBack';
import { alpha, color, font, lane as lanes, radius, space } from '@/theme/tokens';

/** Free vs Plus, row by row. Values are plain numbers or string keys. */
const ROWS: { label: TKey; free: string | TKey; plus: string | TKey }[] = [
  { label: 'plus.rowProfiles', free: '2', plus: '3' },
  { label: 'plus.rowGames', free: '4', plus: 'plus.plusGames' },
  { label: 'plus.rowVideos', free: 'plus.freeVideos', plus: 'plus.plusVideos' },
  { label: 'plus.rowHistory', free: 'plus.freeHistory', plus: 'plus.plusHistory' },
];

/**
 * Payhas Plus, for the parent only: the PIN comes first, so a child never sees
 * a price. Shows the family's plan, what Plus adds and the price; pays by card
 * (Halkbank, Senagat Bank, Rysgal Bank — simulated in test mode) or takes an
 * activation code. In test mode a secret test key turns Plus on or off.
 */
export default function PlusScreen() {
  return (
    <ParentSessionProvider>
      <Plus />
    </ParentSessionProvider>
  );
}

function Plus() {
  const gate = useParentSession();
  const goBack = useGoBack();
  const { plan, refresh } = useFamily();
  const { bottom } = useInsets();
  const toast = useToast();
  const { t } = useT();
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testKey, setTestKey] = useState('');
  const [testMessage, setTestMessage] = useState<{ text: string; ok: boolean } | null>(null);

  /** Runs a parent call; if the session ran out mid-way, asks for the PIN once more and retries. Null if cancelled. */
  const run = useCallback(
    async <T,>(call: (token: string) => Promise<T | null>): Promise<T | null> => {
      const token = await gate.ensure();
      if (!token) return null;
      const res = await call(token);
      if (res) return res;
      gate.invalidate();
      const again = await gate.ensure();
      return again ? call(again) : null;
    },
    [gate],
  );

  // Coming from the dashboard reuses its open session; otherwise ask for the PIN.
  useEffect(() => {
    const open = currentParentToken();
    if (open) gate.adopt(open);
    gate.ensure().then((token) => (token ? setUnlocked(true) : goBack()));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!unlocked) return <View style={styles.root} />;

  const label = (v: string | TKey) => (v.includes('.') ? t(v as TKey) : v);
  const complete = code.replace(/[^A-Z0-9]/g, '').length === 16; // PAYH + 12

  const activate = async () => {
    setBusy(true);
    setMessage(null);
    const res = await run((token) => redeemCode(token, code));
    setBusy(false);
    if (!res) return;
    if (res.result === 'ok') {
      fx.success();
      const text = t('plus.codeOk', { date: planDate(res.plus_until!) });
      setMessage({ text, ok: true });
      toast({ text, icon: 'check' });
      setCode('');
      await refresh();
      return;
    }
    fx.error();
    setMessage({
      text: t(res.result === 'used' ? 'plus.codeUsed' : res.result === 'too_many' ? 'plus.codeTooMany' : 'plus.codeInvalid'),
      ok: false,
    });
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('plus.title')} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Enter index={0} style={styles.hero}>
          <View style={styles.lanesRow}>
            {(['little', 'kids', 'teen', 'adult'] as const).map((l) => (
              <View key={l} style={[styles.laneBar, { backgroundColor: lanes[l].color }]} />
            ))}
          </View>
          <Text style={styles.title}>{t('plus.title')}</Text>
          <Text style={styles.tagline}>{t('plus.tagline')}</Text>
          {plan && (
            <View style={[styles.status, plan.plus && styles.statusPlus]}>
              <Icon name={plan.plus ? 'check' : 'sparkle'} size={14} color={plan.plus ? color.success : color.text2} strokeWidth={2.6} />
              <Text style={[styles.statusText, plan.plus && { color: color.success }]}>
                {plan.plus && plan.plus_until ? t('plus.statusPlus', { date: planDate(plan.plus_until) }) : t('plus.statusFree')}
              </Text>
            </View>
          )}
        </Enter>

        <Enter index={1} style={styles.card}>
          <Text style={styles.price}>{t('plus.price', { price: plan?.price_tmt ?? 20 })}</Text>
          <Text style={styles.muted}>{t('plus.priceSub')}</Text>
        </Enter>

        <Enter index={2} style={[styles.card, styles.table]}>
          <View style={styles.row}>
            <View style={styles.rowLabel} />
            <Text style={[styles.colHead, styles.cell]}>{t('plus.colFree')}</Text>
            <Text style={[styles.colHead, styles.cell, { color: color.ember }]}>{t('plus.colPlus')}</Text>
          </View>
          {ROWS.map((r) => (
            <View key={r.label} style={[styles.row, styles.rowLine]}>
              <Text style={[styles.rowLabel, styles.label]}>{t(r.label)}</Text>
              <Text style={[styles.cell, styles.freeValue]}>{label(r.free)}</Text>
              <Text style={[styles.cell, styles.plusValue]}>{label(r.plus)}</Text>
            </View>
          ))}
          <View style={styles.note}>
            <Icon name="shield" size={16} color={color.success} strokeWidth={2.2} />
            <Text style={[styles.muted, { flex: 1 }]}>{t('plus.safetyNote')}</Text>
          </View>
        </Enter>

        {plan?.card_payments ? (
          <Enter index={3} style={styles.card}>
            <CardPayment
              price={plan.price_tmt}
              testMode={!!plan.test_mode}
              run={run}
              onPaid={async (text) => {
                toast({ text, icon: 'check' });
                await refresh();
              }}
            />
          </Enter>
        ) : (
          <Enter index={3} style={[styles.card, styles.cardRow]}>
            <Icon name="lock" size={18} color={color.text3} strokeWidth={2.2} />
            <Text style={[styles.label, { flex: 1, color: color.text2 }]}>{t('plus.cardTitle')}</Text>
            <View style={styles.soon}>
              <Text style={styles.soonText}>{t('plus.cardSoon')}</Text>
            </View>
          </Enter>
        )}

        <Enter index={4} style={styles.card}>
          <Text style={styles.sectionTitle}>{t('plus.codeTitle')}</Text>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(formatCode(v));
              setMessage(null);
            }}
            placeholder="PAYH-XXXX-XXXX-XXXX"
            placeholderTextColor={color.text3}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={19}
            style={styles.codeInput}
            accessibilityLabel={t('plus.codeTitle')}
          />
          {message && <Text style={[styles.message, { color: message.ok ? color.success : color.danger }]}>{message.text}</Text>}
          <PressScale
            onPress={activate}
            disabled={!complete || busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: !complete || busy }}
            // With card payment open, Pay is the one ember button; Activate steps back.
            style={[styles.activate, plan?.card_payments && styles.activateQuiet, (!complete || busy) && styles.activateOff]}
          >
            <Text style={[styles.activateText, plan?.card_payments && { color: color.text }]}>{busy ? '…' : t('plus.activate')}</Text>
          </PressScale>
          {plan?.plus && <Text style={[styles.muted, { textAlign: 'center' }]}>{t('plus.extendHint')}</Text>}
        </Enter>

        {plan?.test_mode && (
          <PressScale onPress={() => setTestOpen(true)} accessibilityRole="button" style={styles.testRow}>
            <Icon name="sliders" size={16} color={color.text3} strokeWidth={2.2} />
            <Text style={styles.testRowText}>{t('plus.testKeyTitle')}</Text>
          </PressScale>
        )}
      </ScrollView>

      <BottomSheet open={testOpen} onClose={() => setTestOpen(false)} title={t('plus.testKeyTitle')}>
        <View style={styles.sheet}>
          <Text style={styles.muted}>{t('plus.testKeyHint')}</Text>
          <TextInput
            value={testKey}
            onChangeText={(v) => {
              setTestKey(v.toUpperCase());
              setTestMessage(null);
            }}
            placeholder="TEST-XXXX-XXXX-XXXX"
            placeholderTextColor={color.text3}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={19}
            style={styles.codeInput}
            accessibilityLabel={t('plus.testKeyTitle')}
          />
          {testMessage && <Text style={[styles.message, { color: testMessage.ok ? color.success : color.danger }]}>{testMessage.text}</Text>}
          <View style={styles.testButtons}>
            {([true, false] as const).map((on) => (
              <PressScale
                key={String(on)}
                disabled={testKey.length < 19}
                onPress={async () => {
                  const res = await run((token) => applyTestKey(token, testKey, on));
                  if (!res) return;
                  if (res.result !== 'ok') {
                    fx.error();
                    return setTestMessage({ text: t(res.result === 'too_many' ? 'plus.codeTooMany' : 'plus.testWrong'), ok: false });
                  }
                  fx.success();
                  setTestMessage({ text: res.plus && res.plus_until ? t('plus.testOnDone', { date: planDate(res.plus_until) }) : t('plus.testOffDone'), ok: true });
                  await refresh();
                }}
                accessibilityRole="button"
                style={[styles.testButton, testKey.length < 19 && styles.activateOff]}
              >
                <Text style={styles.testButtonText}>{t(on ? 'plus.testOn' : 'plus.testOff')}</Text>
              </PressScale>
            ))}
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  content: { paddingHorizontal: space.lg, gap: space.md },
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  lanesRow: { flexDirection: 'row', gap: 6, marginBottom: space.sm },
  laneBar: { width: 28, height: 8, borderRadius: 4 },
  title: { color: color.text, fontFamily: font.display, fontSize: 34, letterSpacing: -0.8, textAlign: 'center' },
  tagline: { color: color.text2, fontFamily: font.medium, fontSize: 16, textAlign: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm, minHeight: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: color.surface1 },
  statusPlus: { backgroundColor: alpha(color.success, 0.12) },
  statusText: { color: color.text2, fontFamily: font.bold, fontSize: 13 },

  card: { backgroundColor: color.surface1, borderRadius: 24, padding: space.lg, gap: space.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  price: { color: color.text, fontFamily: font.mono, fontSize: 30, letterSpacing: -0.8 },
  muted: { color: color.text3, fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  label: { color: color.text, fontFamily: font.semibold, fontSize: 15 },
  sectionTitle: { color: color.text, fontFamily: font.title, fontSize: 18 },

  table: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  rowLine: { borderTopWidth: 1, borderTopColor: color.line, minHeight: 52 },
  rowLabel: { flex: 1.3 },
  cell: { flex: 1, textAlign: 'center' },
  colHead: { color: color.text2, fontFamily: font.bold, fontSize: 13 },
  freeValue: { color: color.text2, fontFamily: font.medium, fontSize: 14 },
  plusValue: { color: color.text, fontFamily: font.bold, fontSize: 14 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: color.line },

  codeInput: {
    color: color.text,
    fontFamily: font.mono,
    fontSize: 20,
    letterSpacing: 1,
    textAlign: 'center',
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: color.ink,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  message: { fontFamily: font.semibold, fontSize: 14, textAlign: 'center' },
  activate: { height: 52, borderRadius: radius.pill, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  activateOff: { opacity: 0.4 },
  activateQuiet: { backgroundColor: color.surface2 },
  activateText: { color: color.ink, fontFamily: font.bold, fontSize: 16 },
  testRow: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: space.lg },
  testRowText: { color: color.text3, fontFamily: font.semibold, fontSize: 13 },
  sheet: { gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.md },
  testButtons: { flexDirection: 'row', gap: space.sm },
  testButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surface2 },
  testButtonText: { color: color.text, fontFamily: font.bold, fontSize: 15 },
  soon: { paddingHorizontal: 10, minHeight: 26, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surface2 },
  soonText: { color: color.text2, fontFamily: font.bold, fontSize: 12 },
});
