import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { useFamily } from '@/features/family/FamilyProvider';
import { ParentSessionProvider, useParentSession } from '@/features/onboarding/ParentSession';
import { currentParentToken } from '@/features/parent/useParent';
import { formatCode, planDate, redeemCode } from '@/features/plan/plan';
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
 * a price. Shows the family's plan, what Plus adds, the price, and takes an
 * activation code. Card payment slots in here once a bank is chosen.
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
    let token = await gate.ensure();
    let res = token ? await redeemCode(token, code) : null;
    if (token && !res) {
      // The session ran out mid-way: one more PIN, one more try.
      gate.invalidate();
      token = await gate.ensure();
      res = token ? await redeemCode(token, code) : null;
    }
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

        <Enter index={3} style={styles.card}>
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
            style={[styles.activate, (!complete || busy) && styles.activateOff]}
          >
            <Text style={styles.activateText}>{busy ? '…' : t('plus.activate')}</Text>
          </PressScale>
          {plan?.plus && <Text style={[styles.muted, { textAlign: 'center' }]}>{t('plus.extendHint')}</Text>}
        </Enter>

        {!plan?.card_payments && (
          <Enter index={4} style={[styles.card, styles.cardRow]}>
            <Icon name="lock" size={18} color={color.text3} strokeWidth={2.2} />
            <Text style={[styles.label, { flex: 1, color: color.text2 }]}>{t('plus.cardTitle')}</Text>
            <View style={styles.soon}>
              <Text style={styles.soonText}>{t('plus.cardSoon')}</Text>
            </View>
          </Enter>
        )}
      </ScrollView>
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
  activateText: { color: color.ink, fontFamily: font.bold, fontSize: 16 },
  soon: { paddingHorizontal: 10, minHeight: 26, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surface2 },
  soonText: { color: color.text2, fontFamily: font.bold, fontSize: 12 },
});
