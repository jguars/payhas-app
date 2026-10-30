import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon, IconName } from '@/components/Icon';
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
import { alpha, color, font, lane as lanes, pageFill, radius, size, space, themedStyles } from '@/theme/tokens';

/** Free vs Plus, row by row. Values are plain numbers or string keys. */
const ROWS: { label: TKey; icon: IconName; free: string | TKey; plus: string | TKey }[] = [
  { label: 'plus.rowProfiles', icon: 'me', free: '2', plus: '3' },
  { label: 'plus.rowGames', icon: 'game', free: '4', plus: 'plus.plusGames' },
  { label: 'plus.rowVideos', icon: 'play', free: 'plus.freeVideos', plus: 'plus.plusVideos' },
  { label: 'plus.rowHistory', icon: 'clock', free: 'plus.freeHistory', plus: 'plus.plusHistory' },
];

/**
 * Payhas Plus, for the parent only: the PIN comes first, so a child never sees
 * a price. Top to bottom: the price, the family's plan today, Free vs Plus,
 * paying by card (the one ember button), then a folded activation-code row.
 * Pays by card
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
  const [codeOpen, setCodeOpen] = useState<boolean | null>(null);
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

  const used = plan?.profiles ?? 0;
  const limit = plan?.profile_limit ?? 2;
  // Without card payment the code is the only way in, so it starts open.
  const showCode = codeOpen ?? !plan?.card_payments;

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('plus.title')} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: what it is and what it costs, in one glance. */}
        <Enter index={0} style={styles.hero}>
          <View style={styles.lanesRow}>
            {(['little', 'kids', 'teen', 'adult'] as const).map((l) => (
              <View key={l} style={[styles.laneBar, { backgroundColor: lanes[l].color }]} />
            ))}
          </View>
          <Text style={styles.title}>{t('plus.title')}</Text>
          <Text style={styles.tagline}>{t('plus.tagline')}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{plan?.price_tmt ?? 20}</Text>
            <Text style={styles.perMonth}>{t('plus.perMonth')}</Text>
          </View>
          <Text style={styles.muted}>{t('plus.priceSub')}</Text>
        </Enter>

        {/* Your plan: where the family stands today. */}
        {plan && (
          <Enter index={1} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.sectionTitle}>{t('plus.yourPlan')}</Text>
              <View style={[styles.badge, plan.plus && styles.badgePlus]}>
                {plan.plus && <Icon name="sparkle" size={12} color={color.ink} strokeWidth={2.6} />}
                <Text style={[styles.badgeText, plan.plus && { color: color.ink }]}>{t(plan.plus ? 'plus.planPlus' : 'plus.planFree')}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('plus.rowProfiles')}</Text>
              <View style={styles.slots}>
                {Array.from({ length: Math.max(limit, used) }, (_, i) => (
                  <View key={i} style={[styles.slot, i < used && styles.slotOn]} />
                ))}
              </View>
              <Text style={styles.infoValue}>{t('plus.profilesUsed', { used, limit })}</Text>
            </View>
            {plan.plus && plan.plus_until && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('plus.activeUntil')}</Text>
                <Text style={styles.infoValue}>{planDate(plan.plus_until)}</Text>
              </View>
            )}
            {plan.plus && <Text style={styles.muted}>{t('plus.extendHint')}</Text>}
          </Enter>
        )}

        {/* Free vs Plus. */}
        <Enter index={2} style={styles.card}>
          <Text style={styles.sectionTitle}>{t('plus.compareTitle')}</Text>
          <View>
            <View style={styles.row}>
              <View style={styles.rowLabel} />
              <Text style={[styles.cell, styles.colHead]}>{t('plus.colFree')}</Text>
              <View style={styles.cell}>
                <View style={styles.plusHead}>
                  <Text style={styles.plusHeadText}>{t('plus.colPlus')}</Text>
                </View>
              </View>
            </View>
            {ROWS.map((r) => (
              <View key={r.label} style={[styles.row, styles.rowLine]}>
                <View style={[styles.rowLabel, styles.rowLabelInner]}>
                  <View style={styles.rowIcon}>
                    <Icon name={r.icon} size={16} color={color.text2} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.label} numberOfLines={2}>
                    {t(r.label)}
                  </Text>
                </View>
                <Text style={[styles.cell, styles.freeValue]}>{label(r.free)}</Text>
                <View style={[styles.cell, styles.plusCell]}>
                  <Icon name="check" size={14} color={color.success} strokeWidth={3} />
                  <Text style={styles.plusValue}>{label(r.plus)}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.note}>
            <Icon name="shield" size={16} color={color.success} strokeWidth={2.2} />
            <Text style={[styles.muted, { flex: 1 }]}>{t('plus.safetyNote')}</Text>
          </View>
        </Enter>

        {/* Pay: the one ember button on the page. */}
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

        {/* Activation code: a quiet row that opens. */}
        <Enter index={4} style={styles.card}>
          <PressScale
            onPress={() => {
              fx.tap();
              setCodeOpen(!showCode);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: showCode }}
            style={styles.codeHead}
          >
            <Text style={[styles.label, { flex: 1 }]}>{t('plus.codeTitle')}</Text>
            {!showCode && <Text style={styles.codeLink}>{t('plus.codeLink')}</Text>}
            <View style={{ transform: [{ rotate: showCode ? '90deg' : '0deg' }] }}>
              <Icon name="chevron" size={18} color={color.text3} strokeWidth={2.4} />
            </View>
          </PressScale>
          {showCode && (
            <>
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
            </>
          )}
          {!showCode && message && <Text style={[styles.message, { color: message.ok ? color.success : color.danger }]}>{message.text}</Text>}
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

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  content: { paddingHorizontal: space.lg, gap: space.md },

  hero: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    borderRadius: 28,
    backgroundColor: color.surface1,
    experimental_backgroundImage: `linear-gradient(160deg, ${alpha(color.ember, 0.22)}, ${alpha(color.ember, 0.02)} 70%)`,
    borderWidth: 1,
    borderColor: alpha(color.ember, 0.25),
  },
  lanesRow: { flexDirection: 'row', gap: 6, marginBottom: space.xs },
  laneBar: { width: 28, height: 8, borderRadius: 4 },
  title: { color: color.text, fontFamily: font.display, fontSize: size.display, lineHeight: 42, letterSpacing: -0.8, textAlign: 'center' },
  tagline: { color: color.text2, fontFamily: font.medium, fontSize: size.body, textAlign: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: space.md },
  price: { color: color.text, fontFamily: font.mono, fontSize: size.hero, lineHeight: 52, letterSpacing: -1.5 },
  perMonth: { color: color.text2, fontFamily: font.bold, fontSize: size.body },

  card: { backgroundColor: color.surface1, borderRadius: 24, padding: space.lg, gap: space.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: color.text, fontFamily: font.title, fontSize: size.lead },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: color.surface2 },
  badgePlus: { backgroundColor: color.ember },
  badgeText: { color: color.text2, fontFamily: font.bold, fontSize: size.caption },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, borderTopWidth: 1, borderTopColor: color.line, paddingTop: space.sm },
  infoLabel: { flex: 1, color: color.text2, fontFamily: font.semibold, fontSize: size.small },
  infoValue: { color: color.text, fontFamily: font.bold, fontSize: size.small },
  slots: { flexDirection: 'row', gap: 4 },
  slot: { width: 18, height: 6, borderRadius: 3, backgroundColor: color.surface2 },
  slotOn: { backgroundColor: color.ember },
  muted: { color: color.text3, fontFamily: font.medium, fontSize: size.small, lineHeight: 20 },
  label: { color: color.text, fontFamily: font.semibold, fontSize: size.body },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  rowLine: { borderTopWidth: 1, borderTopColor: color.line, minHeight: 56 },
  rowLabel: { flex: 1.4 },
  rowLabelInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface2 },
  cell: { flex: 1, alignItems: 'center', textAlign: 'center' },
  colHead: { color: color.text3, fontFamily: font.bold, fontSize: size.caption },
  plusHead: { paddingHorizontal: 10, minHeight: 22, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.ember },
  plusHeadText: { color: color.ink, fontFamily: font.bold, fontSize: size.caption },
  freeValue: { color: color.text3, fontFamily: font.medium, fontSize: size.small },
  plusCell: { gap: 2 },
  plusValue: { color: color.text, fontFamily: font.bold, fontSize: size.small, textAlign: 'center' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: color.line },

  codeHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 },
  codeLink: { color: color.emberText, fontFamily: font.bold, fontSize: size.small },
  codeInput: {
    color: color.text,
    fontFamily: font.mono,
    fontSize: size.title,
    letterSpacing: 1,
    textAlign: 'center',
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: color.bg,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  message: { fontFamily: font.semibold, fontSize: size.small, textAlign: 'center' },
  activate: { height: 52, borderRadius: radius.pill, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  activateOff: { opacity: 0.4 },
  activateQuiet: { backgroundColor: color.surface2 },
  activateText: { color: color.ink, fontFamily: font.bold, fontSize: size.body },
  testRow: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: space.lg },
  testRowText: { color: color.text3, fontFamily: font.semibold, fontSize: size.small },
  sheet: { gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.md },
  testButtons: { flexDirection: 'row', gap: space.sm },
  testButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surface2 },
  testButtonText: { color: color.text, fontFamily: font.bold, fontSize: size.body },
  soon: { paddingHorizontal: 10, minHeight: 26, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surface2 },
  soonText: { color: color.text2, fontFamily: font.bold, fontSize: size.caption },
}));
