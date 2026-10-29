import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PinPad } from '@/components/PinPad';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { Avatar } from '@/components/ui/Avatar';
import { useFamily } from '@/features/family/FamilyProvider';
import { confirmDestructive, Group, GREEN, LiveDot, MiniMeter, RED, RequestCard, Row, RowIcon } from '@/features/parent/parts';
import { disableParentAlerts, enableParentAlerts, storedPushToken } from '@/features/parent/push';
import { Child, minutes, presence, useParent } from '@/features/parent/useParent';
import { planDate } from '@/features/plan/plan';
import { localized, roleKey, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useGoBack } from '@/lib/useGoBack';
import { useInsets } from '@/lib/useInsets';
import { color, font, space } from '@/theme/tokens';

/**
 * Family: the parent's dashboard home, behind the PIN (15 minutes). Laid out
 * like the family hubs of YouTube, Spotify Kids, Amazon and Lyft: what needs
 * an answer first, then everyone in the family (the parent first), then the
 * account. A child's row opens their page (parent-child.tsx).
 */
export default function FamilyScreen() {
  const { child: initial } = useLocalSearchParams<{ child?: string }>();
  const { token, unlocked, children, unlock, lock, reload, answer } = useParent();
  const { signOut, profiles, plan } = useFamily();
  const { bottom } = useInsets();
  const toast = useToast();
  const goBack = useGoBack();
  const { t, lang } = useT();
  const [deletingAccount, setDeletingAccount] = useState(false);
  // Flags from the last day count as "needs you"; the cut-off is taken when the screen opens.
  const [dayAgo] = useState(() => Date.now() - 24 * 3600_000);

  // Back from a child's page or Payhas Plus: show what changed there.
  useFocusEffect(
    useCallback(() => {
      if (unlocked) reload();
    }, [unlocked, reload]),
  );

  // Opened from a child's Me tab: go straight to that child's page once unlocked.
  const opened = useRef(false);
  useEffect(() => {
    if (unlocked && initial && !opened.current) {
      opened.current = true;
      router.push({ pathname: '/parent-child', params: { id: initial } });
    }
  }, [unlocked, initial]);

  if (!unlocked) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('parent.title')} />
        <View style={styles.pinWrap}>
          <PinPad title={t('common.parentPin')} onComplete={unlock} onCancel={() => goBack()} />
          <Text style={styles.pinHint}>{t('parent.pinHint')}</Text>
        </View>
      </View>
    );
  }

  // Deleting the account asks for the PIN again, even inside an open parent session.
  if (deletingAccount) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('parent.deleteAccount')} />
        <View style={styles.pinWrap}>
          <PinPad
            title={t('parent.deletePinTitle')}
            onCancel={() => setDeletingAccount(false)}
            onComplete={async (pin) => {
              const { data, error } = await supabase.rpc('delete_account', { p_pin: pin });
              if (error) return error.message;
              if (!data) return false;
              toast({ text: t('parent.deletedToast'), icon: 'check' });
              lock();
              await disableParentAlerts().catch(() => {});
              await signOut();
              return true;
            }}
          />
        </View>
      </View>
    );
  }

  const done = (ok: boolean, text: string) => {
    if (!ok) {
      fx.error();
      toast({ text: t('parent.networkError'), icon: 'close' });
      return;
    }
    fx.success();
    toast({ text, icon: 'check' });
  };

  const adults = profiles.filter((p) => p.lane === 'adult').sort((a, b) => Number(b.is_parent) - Number(a.is_parent));
  const avatarOf = (id: string) => profiles.find((p) => p.id === id)?.avatar ?? null;
  const requests = (children ?? []).filter((c) => c.request);
  const flags = (children ?? []).flatMap((c) => c.flags.filter((f) => new Date(f.at).getTime() > dayAgo).map((f) => ({ child: c, flag: f })));
  const atLimit = !!plan && profiles.length >= plan.profile_limit;
  const openChild = (c: Child) => router.push({ pathname: '/parent-child', params: { id: c.id } });

  return (
    <View style={styles.root}>
      <ScreenHeader title="" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + space.xxl }]} showsVerticalScrollIndicator={false}>
        <Enter index={0} style={{ gap: space.xs }}>
          <Text style={styles.title} accessibilityRole="header">
            {t('parent.title')}
          </Text>
          <Text style={styles.subtitle}>{t('parent.familySub')}</Text>
        </Enter>

        {(requests.length > 0 || flags.length > 0) && (
          <Enter index={1} style={{ gap: space.sm }}>
            <Text style={styles.groupTitle}>{t('parent.needsYou')}</Text>
            {requests.map((c) => (
              <RequestCard
                key={c.id}
                name={c.display_name}
                at={c.request!.created_at}
                onAnswer={async (m) => {
                  fx.tap();
                  done(await answer(c, m), m ? t('parent.addedTime', { count: m, name: c.display_name }) : t('parent.toldNotToday', { name: c.display_name }));
                }}
              />
            ))}
            {flags.length > 0 && (
              <View style={styles.group}>
                {flags.map(({ child: c, flag }, i) => (
                  <Row
                    key={c.id + flag.at}
                    first={i === 0}
                    leading={<RowIcon icon="flag" tint={RED} />}
                    label={t('parent.flaggedRow', { name: c.display_name })}
                    sub={localized(lang, flag.caption, flag.caption_i18n)}
                    onPress={() => openChild(c)}
                  />
                ))}
              </View>
            )}
          </Enter>
        )}

        <Enter index={2}>
          <Group title={t('parent.yourFamily')}>
            {adults.map((p, i) => (
              <Row
                key={p.id}
                first={i === 0}
                leading={<Avatar name={p.display_name} avatar={p.avatar} lane={p.lane} size={44} />}
                label={p.is_parent ? t('parent.you', { name: p.display_name }) : p.display_name}
                sub={t(roleKey(p))}
              />
            ))}
            {children == null
              ? [0, 1].map((i) => <View key={i} style={[styles.skeleton, (adults.length > 0 || i > 0) && styles.rowLine]} />)
              : children.map((c, i) => <ChildRow key={c.id} child={c} avatar={avatarOf(c.id)} first={adults.length === 0 && i === 0} onPress={() => openChild(c)} />)}
            <Row
              first={adults.length === 0 && (children?.length ?? 0) === 0}
              leading={
                <View style={styles.addCircle}>
                  <Icon name="plus" size={20} color={color.text2} strokeWidth={2.4} />
                </View>
              }
              label={t('parent.addChild')}
              sub={atLimit && !plan?.plus ? t('plus.limitReached') : undefined}
              onPress={() => router.push(atLimit ? '/plus' : '/add-child')}
            />
          </Group>
        </Enter>

        <Enter index={3}>
          <Group title={t('parent.account')}>
            {plan && (
              <Row
                first
                leading={<RowIcon icon="sparkle" tint={plan.plus ? color.success : color.ember} />}
                label={t('plus.title')}
                value={plan.plus && plan.plus_until ? planDate(plan.plus_until) : t('plus.colFree')}
                onPress={() => router.push('/plus')}
              />
            )}
            <AlertsRow parent={token} first={!plan} onResult={(text, ok) => done(ok, text)} />
            <Row
              leading={<RowIcon icon="lock" tint={color.text2} />}
              label={t('parent.lock')}
              onPress={() => {
                lock();
                goBack();
              }}
              chevron={false}
            />
            <Row
              leading={<RowIcon icon="close" tint={RED} />}
              label={t('parent.signOut')}
              danger
              chevron={false}
              onPress={() =>
                confirmDestructive(t('parent.signOutTitle'), t('parent.signOutBody'), t('parent.signOut'), t('common.cancel'), () => {
                  lock();
                  signOut();
                })
              }
            />
          </Group>
        </Enter>

        <Pressable
          onPress={() => confirmDestructive(t('parent.deleteTitle'), t('parent.deleteBody'), t('parent.deleteConfirm'), t('common.cancel'), () => setDeletingAccount(true))}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.deleteLink}
        >
          <Text style={styles.deleteText}>{t('parent.deleteAccount')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** A child in the family list: avatar with a live dot, name, what they're doing, today against the limit. */
function ChildRow({ child, avatar, first, onPress }: { child: Child; avatar: string | null; first: boolean; onPress: () => void }) {
  const { t } = useT();
  const p = presence(child, t);
  const today = child.week[child.week.length - 1];
  const used = (today?.video_s ?? 0) + (today?.game_s ?? 0);
  const limit = child.daily_limit_minutes == null ? null : child.daily_limit_minutes + child.extra_minutes;
  const status = child.paused ? t('parent.paused') : p.text;
  return (
    <Row
      first={first}
      onPress={onPress}
      accessibilityLabel={`${child.display_name}, ${t(roleKey(child))}. ${status}`}
      leading={
        <View>
          <Avatar name={child.display_name} avatar={avatar} lane={child.lane} size={44} />
          {p.live && !child.paused && (
            <View style={styles.liveBadge}>
              <LiveDot />
            </View>
          )}
        </View>
      }
      label={child.display_name}
      sub={
        <Text style={[styles.status, child.paused ? { color: color.verified } : p.live && { color: GREEN }]} numberOfLines={1}>
          {t(roleKey(child))} · {status}
        </Text>
      }
      value={
        <View style={styles.today}>
          <Text style={styles.todayText} numberOfLines={1}>
            {limit ? t('parent.todayOf', { used: minutes(t, used), limit: minutes(t, limit * 60) }) : minutes(t, used)}
          </Text>
          {limit != null && <MiniMeter progress={used / (limit * 60)} />}
        </View>
      }
    />
  );
}

/** Opt this phone in to parent alerts. Pushes go only to phones switched on here. */
function AlertsRow({ parent, first, onResult }: { parent: string | null; first: boolean; onResult: (text: string, ok: boolean) => void }) {
  const { t } = useT();
  const [on, setOn] = useState(() => !!storedPushToken());
  const [busy, setBusy] = useState(false);

  const flip = async () => {
    if (busy) return;
    setBusy(true);
    if (on) {
      await disableParentAlerts();
      setOn(false);
      onResult(t('parent.alertsOffToast'), true);
    } else if (parent) {
      const r = await enableParentAlerts(parent);
      if (r === 'on') {
        setOn(true);
        onResult(t('parent.alertsOnToast'), true);
      } else {
        fx.error();
        Alert.alert(
          t('parent.alertsFailTitle'),
          r === 'denied' ? t('parent.alertsDenied') : r === 'unsupported' ? t('parent.alertsUnsupported') : t('parent.alertsError'),
        );
      }
    }
    setBusy(false);
  };

  return <Row first={first} leading={<RowIcon icon="inbox" tint={GREEN} />} label={t('parent.alertsLabel')} sub={t('parent.alertsSub')} toggle={on} onPress={flip} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingBottom: 80 },
  pinHint: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  content: { paddingHorizontal: space.lg, gap: space.xl },
  title: { color: color.text, fontFamily: font.display, fontSize: 34, letterSpacing: -0.8 },
  subtitle: { color: color.text2, fontFamily: font.medium, fontSize: 15, lineHeight: 21 },
  groupTitle: { color: color.text2, fontFamily: font.bold, fontSize: 13, letterSpacing: 0.3, paddingHorizontal: space.xs },
  group: { backgroundColor: color.surface1, borderRadius: 24, overflow: 'hidden' },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  skeleton: { height: 72, marginHorizontal: space.lg, opacity: 0.4 },
  status: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  today: { alignItems: 'flex-end', gap: 6, minWidth: 72 },
  todayText: { color: color.text2, fontFamily: font.mono, fontSize: 13 },
  liveBadge: { position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface1 },
  addCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface2 },
  deleteLink: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', paddingHorizontal: space.lg },
  deleteText: { color: color.text3, fontFamily: font.semibold, fontSize: 13, textDecorationLine: 'underline' },
});
