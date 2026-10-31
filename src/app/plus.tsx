import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { useToast } from '@/components/Toast';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
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
import { border, color, control, font, iconSize, iconStroke, lane as lanes, layout, pageFill, radius, space, themedStyles, type } from '@/theme/tokens';

/** The family on the card: up to 4 seats (you and 3 children). */
const SEATS = 4;
/** Seats a little smaller than a control: four of them and the date share the card's width. */
const SEAT = control.sm + space.xs;
const CARD_HEIGHT = 208;

/** What Plus gives, as four big numbers (what's always free is said in one line under them). */
const STATS: { value: string; label: TKey; accent?: boolean }[] = [
  { value: '3', label: 'plus.statChildren' },
  { value: '10', label: 'plus.statGames' },
  { value: '∞', label: 'plus.statVideos', accent: true },
  { value: '7', label: 'plus.statHistory' },
];

/**
 * Payhas Plus, for the parent only: the PIN comes first, so a child never sees
 * a price. The membership card (approved 2026-10-31, variant 5): a glossy
 * Payhas Plus card with the family's own avatars on it (empty seats show the
 * room Plus makes), four big numbers, one line on what stays free, and one
 * ember button at the bottom. Get Plus opens card payment (Halkbank, Senagat
 * Bank, Rysgal Bank — simulated in test mode) or, while cards are off, the
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
  const { plan, profiles, refresh } = useFamily();
  const { top, bottom } = useInsets();
  const toast = useToast();
  const { t } = useT();
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [sheet, setSheet] = useState<'code' | 'pay' | 'test' | null>(null);
  const [testKey, setTestKey] = useState('');
  const [testMessage, setTestMessage] = useState<{ text: string; ok: boolean } | null>(null);
  // The card's own size: the gradient is drawn to it in points (percent sizes drew it short on iOS).
  const [cardSize, setCardSize] = useState({ w: 0, h: CARD_HEIGHT });

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
  const onPlus = !!plan?.plus;
  const price = plan?.price_tmt ?? 20;

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
      setSheet(null);
      await refresh();
      return;
    }
    fx.error();
    setMessage({
      text: t(res.result === 'used' ? 'plus.codeUsed' : res.result === 'too_many' ? 'plus.codeTooMany' : 'plus.codeInvalid'),
      ok: false,
    });
  };

  // Get Plus opens the card form when card payment is on; otherwise the code, the one way in today.
  const getPlus = () => {
    fx.tap();
    setSheet(plan?.card_payments ? 'pay' : 'code');
  };

  // The parent first, then the children; empty seats are the room Plus makes.
  const family = [...profiles.filter((p) => p.is_parent), ...profiles.filter((p) => !p.is_parent)].slice(0, SEATS);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: top + space.sm, paddingBottom: bottom + control.lg * 3 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.back}>
          <IconButton icon="back" plain label={t('common.back')} onPress={() => goBack()} />
        </View>

        <Enter index={0}>
          <View style={styles.card} onLayout={(e) => setCardSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} accessible accessibilityLabel={onPlus && plan?.plus_until ? t('plus.statusPlus', { date: planDate(plan.plus_until) }) : t('plus.title')}>
            <Svg style={styles.cardArt} width={cardSize.w} height={cardSize.h}>
              <Defs>
                <LinearGradient id="plus" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={color.ember} />
                  <Stop offset="1" stopColor={lanes.adult.color} />
                </LinearGradient>
              </Defs>
              <Rect width={cardSize.w} height={cardSize.h} rx={radius.lg} fill="url(#plus)" />
              <Circle cx={cardSize.w * 0.92} cy={-cardSize.h * 0.04} r={cardSize.h * 0.55} fill={color.ink} fillOpacity={0.08} />
              <Circle cx={cardSize.w * 0.7} cy={cardSize.h * 1.18} r={cardSize.h * 0.45} fill={color.ink} fillOpacity={0.06} />
            </Svg>
            <View style={styles.cardTop}>
              <Text style={styles.wordmark}>payhas</Text>
              <View style={styles.plusPill}>
                <Icon name="sparkle" size={iconSize.sm} color={color.inverse} strokeWidth={iconStroke(iconSize.sm)} />
                <Text style={styles.plusPillText}>PLUS</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.seats}>
                {Array.from({ length: SEATS }, (_, i) => {
                  const p = family[i];
                  return (
                    <View key={i} style={[styles.seat, i > 0 && styles.seatOverlap, !p && styles.seatEmpty]}>
                      {p && <Avatar name={p.display_name} avatar={p.avatar} lane={p.lane} size={SEAT} />}
                    </View>
                  );
                })}
              </View>
              <Text style={styles.cardLabel} numberOfLines={2}>{onPlus && plan?.plus_until ? t('plus.statusPlus', { date: planDate(plan.plus_until) }) : t('plus.familyBadge')}</Text>
            </View>
          </View>
        </Enter>

        <View style={styles.stats}>
          {STATS.map((s, i) => (
            <Enter key={s.label} index={1 + i} style={styles.stat}>
              <Text style={[styles.statValue, s.accent && { color: lanes.kids.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{t(s.label)}</Text>
            </Enter>
          ))}
        </View>

        <Enter index={5} style={styles.note}>
          <Icon name="shield" size={iconSize.sm} color={color.success} strokeWidth={iconStroke(iconSize.sm)} />
          <Text style={styles.noteText}>{t('plus.safetyShort')}</Text>
        </Enter>

        {plan?.test_mode && (
          <PressScale onPress={() => setSheet('test')} accessibilityRole="button" style={styles.quietRow}>
            <Icon name="sliders" size={iconSize.sm} color={color.text3} strokeWidth={iconStroke(iconSize.sm)} />
            <Text style={styles.quietText}>{t('plus.testKeyTitle')}</Text>
          </PressScale>
        )}
      </ScrollView>

      {/* One ember button, always in reach; on Plus, another code adds time. */}
      <View style={[styles.bar, { paddingBottom: bottom + space.lg }]}>
        {onPlus ? (
          <Button variant="secondary" label={t('plus.addTime')} onPress={() => setSheet('code')} />
        ) : (
          <Button label={t('plus.getPlusPrice', { price })} onPress={getPlus} />
        )}
        <PressScale onPress={() => setSheet('code')} accessibilityRole="button" style={styles.quietRow}>
          <Text style={styles.codeLink}>{onPlus ? t('plus.extendHint') : t('plus.codeTitle')}</Text>
        </PressScale>
      </View>

      <BottomSheet open={sheet === 'code'} onClose={() => setSheet(null)} title={t('plus.codeTitle')}>
        <View style={styles.sheet}>
          <TextField
            code
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
            accessibilityLabel={t('plus.codeTitle')}
            error={message && !message.ok ? message.text : null}
          />
          <Button label={t('plus.activate')} disabled={!complete || busy} loading={busy} onPress={activate} />
          {!plan?.card_payments && <Text style={styles.sheetNote}>{`${t('plus.cardTitle')} · ${t('plus.cardSoon')}`}</Text>}
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === 'pay'} onClose={() => setSheet(null)} title={t('plus.cardTitle')}>
        <View style={styles.sheet}>
          {plan?.card_payments && (
            <CardPayment
              price={plan.price_tmt}
              testMode={!!plan.test_mode}
              run={run}
              onPaid={async (text) => {
                toast({ text, icon: 'check' });
                setSheet(null);
                await refresh();
              }}
            />
          )}
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === 'test'} onClose={() => setSheet(null)} title={t('plus.testKeyTitle')}>
        <View style={styles.sheet}>
          <Text style={styles.sheetNote}>{t('plus.testKeyHint')}</Text>
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
              <View key={String(on)} style={styles.grow}>
                <Button
                  variant="secondary"
                  label={t(on ? 'plus.testOn' : 'plus.testOff')}
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
                />
              </View>
            ))}
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  content: { paddingHorizontal: layout.gutter + space.xs, gap: space.xl },
  back: { marginLeft: -space.md, alignSelf: 'flex-start' },
  card: { height: CARD_HEIGHT, borderRadius: radius.lg, overflow: 'hidden', padding: space.lg + space.xs, justifyContent: 'space-between' },
  cardArt: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { color: color.ink, fontFamily: font.display, ...type.title },
  plusPill: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: control.sm, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: color.ink },
  plusPillText: { color: color.inverse, fontFamily: font.bold, ...type.small },
  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  seats: { flexDirection: 'row' },
  seat: { width: SEAT, height: SEAT, borderRadius: radius.pill, borderWidth: border.strong, borderColor: color.ember },
  seatOverlap: { marginLeft: -space.md },
  seatEmpty: { borderStyle: 'dashed', borderColor: color.ink, opacity: 0.5 },
  cardLabel: { flexShrink: 1, color: color.ink, fontFamily: font.bold, ...type.small, textAlign: 'right' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.xl, marginTop: space.md },
  stat: { width: '50%', alignItems: 'center', gap: space.xs },
  statValue: { color: color.text, fontFamily: font.display, ...type.display },
  statLabel: { color: color.text2, fontFamily: font.semibold, ...type.small, textAlign: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.md },
  noteText: { flexShrink: 1, color: color.text2, fontFamily: font.medium, ...type.small },
  quietRow: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: space.xs, minHeight: control.md, paddingHorizontal: space.lg },
  quietText: { color: color.text3, fontFamily: font.semibold, ...type.small },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter + space.xs, paddingTop: space.md, gap: space.xs, ...pageFill() },
  codeLink: { color: color.text2, fontFamily: font.bold, ...type.small, textDecorationLine: 'underline' },
  sheet: { gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.md },
  sheetNote: { color: color.text3, fontFamily: font.medium, ...type.small, textAlign: 'center' },
  message: { fontFamily: font.semibold, ...type.small, textAlign: 'center' },
  testButtons: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
}));
