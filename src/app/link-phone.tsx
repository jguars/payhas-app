import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PinPad } from '@/components/PinPad';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { answerDevice, createLinkCode, LinkCode, linkStatus } from '@/features/parent/devices';
import { useParent } from '@/features/parent/useParent';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { useGoBack } from '@/lib/useGoBack';
import { useInsets } from '@/lib/useInsets';
import { color, font, iconSize, iconStroke, layout, pageFill, space, themedStyles, type } from '@/theme/tokens';

/** How often the page asks whether the phone has used the code. */
const POLL_MS = 2000;

/**
 * Link a phone (approved flow D + A's Allow): a 6-digit code for one child's
 * phone (?profile=&name=), a shared phone (no profile), or another parent
 * (?kind=coparent — they also confirm their own number when they join). The page waits on
 * its own; when the new phone types the code, the Allow sheet comes up here —
 * the code alone never lets a phone in.
 */
export default function LinkPhoneScreen() {
  const { profile, name, kind } = useLocalSearchParams<{ profile?: string; name?: string; kind?: string }>();
  const coparent = kind === 'coparent';
  const { token, unlocked, unlock } = useParent();
  const goBack = useGoBack();
  const toast = useToast();
  const { top, bottom } = useInsets();
  const { t } = useT();
  const [code, setCode] = useState<LinkCode | null>(null);
  const [failed, setFailed] = useState(false);
  const [expired, setExpired] = useState(false);
  const [joined, setJoined] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const answered = useRef(false);

  const fresh = useCallback(async () => {
    if (!token) return;
    setFailed(false);
    setExpired(false);
    setJoined(null);
    const c = await createLinkCode(token, profile ?? null, coparent);
    if (!c) return setFailed(true);
    setCode(c);
  }, [token, profile, coparent]);

  useEffect(() => {
    if (unlocked) fresh();
  }, [unlocked, fresh]);

  // Countdown and status, while a code is out and nobody has joined yet.
  useEffect(() => {
    if (!code || !token || joined || expired) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      const s = await linkStatus(token, code.id);
      if (!s) return;
      if (s.state === 'expired') setExpired(true);
      else if (s.state === 'joined') {
        fx.success();
        setJoined(s.device);
      }
    }, POLL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [code, token, joined, expired]);

  if (!unlocked) {
    return (
      <View style={styles.root}>
        <View style={[styles.head, { paddingTop: top + space.sm }]}>
          <PageHeader back title={t('parent.title')} />
        </View>
        <View style={styles.pinWrap}>
          <PinPad title={t('common.parentPin')} onComplete={unlock} onCancel={() => goBack()} />
        </View>
      </View>
    );
  }

  const answer = async (allow: boolean) => {
    if (!token || !joined || busy) return;
    setBusy(true);
    const ok = await answerDevice(token, joined.id, allow);
    setBusy(false);
    answered.current = true;
    if (!ok) {
      fx.error();
      return toast({ text: t('parent.networkError'), icon: 'close' });
    }
    if (allow) {
      fx.success();
      toast({ text: t('parent.allowedToast', { name: joined.name }), icon: 'check' });
    }
    goBack();
  };

  const left = code ? Math.max(0, Math.round((new Date(code.expires_at).getTime() - now) / 1000)) : 0;
  const shown = code ? `${code.code.slice(0, 3)} ${code.code.slice(3)}` : '';
  const title = coparent ? t('parent.inviteParent') : name ? t('parent.linkTitle', { name }) : t('parent.linkSharedTitle');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + space.sm, paddingBottom: bottom + space.xxl }]} showsVerticalScrollIndicator={false}>
        <Enter index={0}>
          <PageHeader back title={title} subtitle={coparent ? t('parent.inviteParentSub') : t('parent.linkSub')} />
        </Enter>

        <Enter index={1}>
          <Card>
            {failed ? (
              <View style={styles.center}>
                <Text style={styles.muted}>{t('parent.networkError')}</Text>
                <Button variant="secondary" label={t('parent.retry')} onPress={fresh} />
              </View>
            ) : expired || (code && left === 0) ? (
              <View style={styles.center}>
                <Text style={styles.expired}>{t('parent.linkExpired')}</Text>
                <Button label={t('parent.linkNewCode')} onPress={fresh} />
              </View>
            ) : !code ? (
              <ActivityIndicator color={color.text2} style={styles.loading} />
            ) : (
              <View style={styles.center}>
                {/* Read aloud digit by digit, not as one big number. */}
                <Text style={styles.code} accessibilityLabel={code.code.split('').join(' ')} selectable>
                  {shown}
                </Text>
                <View style={styles.row}>
                  <Icon name="clock" size={iconSize.sm} color={color.text2} strokeWidth={iconStroke(iconSize.sm)} />
                  <Text style={styles.muted}>
                    {t('parent.linkExpires')} · {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
                  </Text>
                </View>
              </View>
            )}
          </Card>
        </Enter>

        {code && !expired && !failed && left > 0 && (
          <Enter index={2}>
            <Card>
              <View style={styles.row}>
                <ActivityIndicator color={color.text2} />
                <View style={styles.grow}>
                  <Text style={styles.label}>{t('parent.linkWaiting')}</Text>
                  <Text style={styles.muted}>{t('parent.linkWaitingSub')}</Text>
                </View>
              </View>
            </Card>
          </Enter>
        )}
      </ScrollView>

      <BottomSheet open={!!joined} onClose={() => !answered.current && answer(false)} title={joined ? t('parent.allowTitle', { name: joined.name }) : ''}>
        <View style={styles.sheet}>
          <Text style={styles.sheetBody}>{coparent ? t('parent.allowCoParent') : name ? t('parent.allowChild', { child: name }) : t('parent.allowShared')}</Text>
          <Button label={t('parent.allow')} loading={busy} onPress={() => answer(true)} />
          <Button variant="secondary" label={t('parent.notNow')} disabled={busy} onPress={() => answer(false)} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  head: { paddingHorizontal: layout.gutter },
  pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: space.xxxl },
  content: { paddingHorizontal: layout.gutter, gap: space.md },
  center: { alignItems: 'center', gap: space.md, paddingVertical: space.md },
  loading: { paddingVertical: space.xxl },
  code: { color: color.text, fontFamily: font.display, ...type.hero, letterSpacing: space.sm },
  expired: { color: color.text, fontFamily: font.title, ...type.lead },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1, gap: space.xs / 2 },
  label: { color: color.text, fontFamily: font.semibold, ...type.body },
  muted: { color: color.text2, fontFamily: font.medium, ...type.small },
  sheet: { gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.md },
  sheetBody: { color: color.text2, fontFamily: font.medium, ...type.body },
}));
