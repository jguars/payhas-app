import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { useToast } from '@/components/Toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListGroup, ListRow } from '@/components/ui/List';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/TextField';
import { useFamily } from '@/features/family/FamilyProvider';
import { ParentSessionProvider, useParentSession } from '@/features/onboarding/ParentSession';
import { currentParentToken } from '@/features/parent/useParent';
import { CardPayment } from '@/features/plan/CardPayment';
import { applyTestKey, formatCode, planDate, redeemCode } from '@/features/plan/plan';
import { TKey, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { useInsets } from '@/lib/useInsets';
import { useGoBack } from '@/lib/useGoBack';
import { border, color, control, font, iconSize, iconStroke, layout, pageFill, radius, space, themedStyles, type } from '@/theme/tokens';

/**
 * Payhas Plus, for the parent only: the PIN comes first, so a child never sees
 * a price. Plus B (approved 2026-10-31): two plan cards — Free, marked while
 * it's the family's, and Plus with the price and the one ember button — then
 * the always-free note and a quiet activation-code link. Get Plus opens card
 * payment (Halkbank, Senagat Bank, Rysgal Bank — simulated in test mode) or,
 * while cards are off, the code. In test mode a secret test key turns Plus on
 * or off.
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
  const { top, bottom } = useInsets();
  const toast = useToast();
  const { t } = useT();
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
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

  const showCode = codeOpen;

  // Get Plus opens the card form when card payment is on; otherwise the code, the one way in today.
  const getPlus = () => {
    fx.tap();
    if (plan?.card_payments) setPayOpen(true);
    else setCodeOpen(true);
  };
  const free: TKey[] = ['plus.featFreeProfiles', 'plus.featFreeLimits', 'plus.featFreeHistory'];
  const plus: TKey[] = ['plus.featPlusProfiles', 'plus.featPlusGames', 'plus.featPlusVideos', 'plus.featPlusHistory'];

  const onPlus = !!plan?.plus;
  const freeCard = (
    <Enter key="free" index={onPlus ? 2 : 1}>
      <Card>
        <View style={styles.planHead}>
          <Text style={styles.planName}>{t('plus.planFree')}</Text>
          {plan && !plan.plus && <Badge label={t('plus.currentPlan')} />}
        </View>
        <Features keys={free} />
      </Card>
    </Enter>
  );
  const plusCard = (
    <Enter key="plus" index={onPlus ? 1 : 2}>
      {/* Ember marks the plan to buy; once it's theirs, the header carries the status. */}
      <Card selected={!onPlus}>
        <View style={styles.planHead}>
          <Text style={styles.planName}>{t('plus.planPlus')}</Text>
          <Badge label={plan?.plus ? t('plus.currentPlan') : t('plus.familyBadge')} tone="plus" icon="sparkle" />
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{plan?.price_tmt ?? 20}</Text>
          <Text style={styles.perMonth}>{t('plus.perMonth')}</Text>
        </View>
        <Features keys={plus} />
        {plan?.plus ? (
          <View style={styles.until}>
            <Text style={styles.untilText}>
              {t('plus.activeUntil')} {plan.plus_until ? planDate(plan.plus_until) : ''}
            </Text>
            <Text style={styles.muted}>{t('plus.extendHint')}</Text>
          </View>
        ) : payOpen && plan?.card_payments ? (
          <CardPayment
            price={plan.price_tmt}
            testMode={!!plan.test_mode}
            run={run}
            onPaid={async (text) => {
              toast({ text, icon: 'check' });
              setPayOpen(false);
              await refresh();
            }}
          />
        ) : (
          <>
            <Button label={t('plus.getPlus')} onPress={getPlus} />
            {!plan?.card_payments && <Text style={[styles.muted, styles.center]}>{`${t('plus.cardTitle')} · ${t('plus.cardSoon')}`}</Text>}
          </>
        )}
      </Card>
    </Enter>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: top + space.sm, paddingBottom: bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Enter index={0}>
          {/* On Plus, the header says so and the Plus card comes first: this is their plan, not a pitch. */}
          <PageHeader back title={t('plus.yourPlan')} subtitle={onPlus && plan?.plus_until ? t('plus.codeOk', { date: planDate(plan.plus_until) }) : t('plus.pickSub')} />
        </Enter>

        {/* Free, where most families start, and Plus, the recommended card with the price and the one ember button. */}
        {onPlus ? [plusCard, freeCard] : [freeCard, plusCard]}

        <Enter index={3} style={styles.note}>
          <Icon name="shield" size={iconSize.sm} color={color.success} strokeWidth={iconStroke(iconSize.sm)} />
          <Text style={[styles.muted, styles.grow]}>{t('plus.safetyNote')}</Text>
        </Enter>

        {/* Activation code: a quiet link that opens the field. */}
        <Enter index={4} style={styles.code}>
          {!showCode ? (
            <ListGroup>
              <ListRow
                first
                icon="lock"
                label={t('plus.codeTitle')}
                onPress={() => {
                  fx.tap();
                  setCodeOpen(true);
                }}
              />
            </ListGroup>
          ) : (
            <Card>
              <TextField
                code
                label={t('plus.codeTitle')}
                value={code}
                onChangeText={(v) => {
                  setCode(formatCode(v));
                  setMessage(null);
                }}
                placeholder="PAYH-XXXX-XXXX-XXXX"
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                maxLength={19}
                error={message && !message.ok ? message.text : null}
              />
              {message?.ok && <Text style={[styles.message, { color: color.success }]}>{message.text}</Text>}
              <Button variant="secondary" label={t('plus.activate')} disabled={!complete || busy} loading={busy} onPress={activate} />
            </Card>
          )}
        </Enter>

        {plan?.test_mode && (
          <PressScale onPress={() => setTestOpen(true)} accessibilityRole="button" style={styles.testRow}>
            <Icon name="sliders" size={iconSize.sm} color={color.text3} strokeWidth={iconStroke(iconSize.sm)} />
            <Text style={styles.testRowText}>{t('plus.testKeyTitle')}</Text>
          </PressScale>
        )}
      </ScrollView>

      <BottomSheet open={testOpen} onClose={() => setTestOpen(false)} title={t('plus.testKeyTitle')}>
        <View style={styles.sheet}>
          <Text style={styles.muted}>{t('plus.testKeyHint')}</Text>
          <TextField
            code
            value={testKey}
            onChangeText={(v) => {
              setTestKey(v.toUpperCase());
              setTestMessage(null);
            }}
            placeholder="TEST-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={19}
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

/** A plan's features, one checked line each. */
function Features({ keys }: { keys: TKey[] }) {
  const { t } = useT();
  return (
    <View style={styles.features}>
      {keys.map((k) => (
        <View key={k} style={styles.feature}>
          <Icon name="check" size={iconSize.md} color={color.success} strokeWidth={iconStroke(iconSize.md)} />
          <Text style={styles.featureText}>{t(k)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  content: { paddingHorizontal: layout.gutter, gap: space.md },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  planName: { color: color.text, fontFamily: font.title, ...type.title },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  price: { color: color.text, fontFamily: font.display, ...type.display },
  perMonth: { color: color.text2, fontFamily: font.semibold, ...type.body },
  features: { gap: space.sm },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  featureText: { flex: 1, color: color.text, fontFamily: font.medium, ...type.body },
  until: { gap: space.xs, paddingTop: space.md, borderTopWidth: border.hairline, borderTopColor: color.line },
  untilText: { color: color.text, fontFamily: font.semibold, ...type.body },
  muted: { color: color.text3, fontFamily: font.medium, ...type.small },
  center: { textAlign: 'center' },
  grow: { flex: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingHorizontal: space.xs },
  code: { alignItems: 'stretch' },
  message: { fontFamily: font.semibold, ...type.small, textAlign: 'center' },
  activateOff: { opacity: 0.4 },
  testRow: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: space.xs, minHeight: control.md, paddingHorizontal: space.lg },
  testRowText: { color: color.text3, fontFamily: font.semibold, ...type.small },
  sheet: { gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.md },
  testButtons: { flexDirection: 'row', gap: space.sm },
  testButton: { flex: 1, minHeight: control.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surface2 },
  testButtonText: { color: color.text, fontFamily: font.bold, ...type.body },
}));
