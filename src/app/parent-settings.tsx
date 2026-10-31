import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PinPad } from '@/components/PinPad';
import { useToast, useToastFlush } from '@/components/Toast';
import { Avatar } from '@/components/ui/Avatar';
import { ListGroup, ListRow } from '@/components/ui/List';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFamily } from '@/features/family/FamilyProvider';
import { useLinkedPhones } from '@/features/parent/devices';
import { confirmDestructive } from '@/features/parent/parts';
import { disableParentAlerts, enableParentAlerts, storedPushToken } from '@/features/parent/push';
import { useParent } from '@/features/parent/useParent';
import { planDate } from '@/features/plan/plan';
import { roleKey, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useGoBack } from '@/lib/useGoBack';
import { useInsets } from '@/lib/useInsets';
import { color, font, iconSize, iconStroke, layout, pageFill, space, themedStyles, type } from '@/theme/tokens';

/**
 * Family settings, behind the gear on the dashboard (Family C keeps the
 * dashboard about the children): the grown-ups, the plan, alerts on this
 * phone, lock and sign out, and — quietest of all — deleting the account.
 * Shares the dashboard's parent session; asks for the PIN if it ran out.
 */
export default function ParentSettingsScreen() {
  const { token, unlocked, unlock, lock } = useParent();
  const { signOut, profiles, plan } = useFamily();
  const flush = useToastFlush();
  const toast = useToast();
  const goBack = useGoBack();
  const { top, bottom } = useInsets();
  const { t } = useT();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const linked = useLinkedPhones(token);
  // Back from linking a phone: show it.
  useFocusEffect(
    useCallback(() => {
      linked.reload();
    }, [linked.reload]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!unlocked || deletingAccount) {
    return (
      <View style={styles.root}>
        <View style={[styles.pinHead, { paddingTop: top + space.sm }]}>
          <PageHeader back title={deletingAccount ? t('parent.deleteAccount') : t('parent.settings')} />
        </View>
        <View style={styles.pinWrap}>
          {deletingAccount ? (
            // Deleting the account asks for the PIN again, even inside an open parent session.
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
          ) : (
            <PinPad title={t('common.parentPin')} onComplete={unlock} onCancel={() => goBack()} />
          )}
        </View>
      </View>
    );
  }

  const done = (ok: boolean, text: string) => {
    if (!ok) {
      fx.error();
      return toast({ text: t('parent.networkError'), icon: 'close' });
    }
    fx.success();
    toast({ text, icon: 'check' });
  };
  const others = (linked.phones ?? []).filter((ph) => ph.kind !== 'child');
  const adults = profiles.filter((p) => p.lane === 'adult').sort((a, b) => Number(b.is_parent) - Number(a.is_parent));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + space.sm, paddingBottom: bottom + space.xxl }]} showsVerticalScrollIndicator={false}>
        <Enter index={0}>
          <PageHeader back title={t('parent.settings')} />
        </Enter>

        <Enter index={1}>
          <ListGroup title={t('parent.account')}>
            {adults.map((p, i) => (
              <ListRow
                key={p.id}
                first={i === 0}
                leading={<Avatar name={p.display_name} avatar={p.avatar} lane={p.lane} size={40} />}
                label={p.is_parent ? t('parent.you', { name: p.display_name }) : p.display_name}
                sub={t(roleKey(p))}
                onPress={() => router.push({ pathname: '/profile-edit', params: { id: p.id } })}
              />
            ))}
            {plan && (
              <ListRow
                first={adults.length === 0}
                icon="sparkle"
                label={t('plus.title')}
                value={plan.plus && plan.plus_until ? planDate(plan.plus_until) : t('parent.freePlan')}
                onPress={() => router.push('/plus')}
              />
            )}
            <AlertsRow parent={token} first={adults.length === 0 && !plan} onResult={done} />
            <ListRow
              icon="lock"
              label={t('parent.lock')}
              chevron={false}
              onPress={async () => {
                await flush(); // send a waiting +15 while the session is still open
                lock();
                goBack(); // the dashboard underneath shows its PIN pad again
              }}
            />
            {/* A door, not a red X (X means close here); the confirm dialog guards it, red stays for Delete. */}
            <ListRow
              icon="logout"
              label={t('parent.signOut')}
              chevron={false}
              onPress={() =>
                confirmDestructive(t('parent.signOutTitle'), t('parent.signOutBody'), t('parent.signOut'), t('common.cancel'), async () => {
                  await flush();
                  lock();
                  signOut();
                })
              }
            />
          </ListGroup>
        </Enter>

        {/* Phones that aren't one child's: those are linked and removed on that child's card in Family. */}
        <Enter index={2}>
          <ListGroup title={t('parent.phonesTitle')} footer={t('parent.phonesFooter')}>
            {others.map((ph, i) => (
              <ListRow
                key={ph.id}
                first={i === 0}
                icon="link"
                label={ph.name}
                sub={
                  ph.status === 'pending'
                    ? t('parent.phoneWaiting')
                    : ph.kind === 'coparent'
                      ? `${t('parent.coParent')} · ${ph.phone ?? ''}`
                      : t('parent.sharedPhone')
                }
                value={<Text style={styles.remove}>{t('parent.removePhone')}</Text>}
                chevron={false}
                onPress={() =>
                  confirmDestructive(t('parent.removePhoneTitle', { name: ph.name }), t('parent.removePhoneBody'), t('parent.removePhone'), t('common.cancel'), async () =>
                    done(await linked.remove(ph.id), t('parent.removedToast', { name: ph.name })),
                  )
                }
              />
            ))}
            <ListRow first={others.length === 0} icon="plus" label={t('parent.addSharedPhone')} onPress={() => router.push('/link-phone')} />
            {/* Another grown-up with their own login: same code and Allow, plus their own number. */}
            <ListRow icon="me" label={t('parent.inviteParent')} onPress={() => router.push({ pathname: '/link-phone', params: { kind: 'coparent' } })} />
          </ListGroup>
        </Enter>

        <View style={styles.footer}>
          <View style={styles.trust}>
            <Icon name="shield" size={iconSize.sm} color={color.text3} strokeWidth={iconStroke(iconSize.sm)} />
            <Text style={styles.footnote}>{t('parent.trustLine')}</Text>
          </View>
          {/* The most destructive action is the quietest thing on the page. */}
          <Pressable
            onPress={() => confirmDestructive(t('parent.deleteTitle'), t('parent.deleteBody'), t('parent.deleteConfirm'), t('common.cancel'), () => setDeletingAccount(true))}
            accessibilityRole="button"
            hitSlop={space.md}
          >
            <Text style={styles.deleteLink}>{t('parent.deleteAccount')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/** Opt this phone in to parent alerts. Pushes go only to phones switched on here. */
function AlertsRow({ parent, first, onResult }: { parent: string | null; first: boolean; onResult: (ok: boolean, text: string) => void }) {
  const { t } = useT();
  const [on, setOn] = useState(() => !!storedPushToken());
  const [busy, setBusy] = useState(false);

  const flip = async () => {
    if (busy) return;
    setBusy(true);
    if (on) {
      await disableParentAlerts();
      setOn(false);
      onResult(true, t('parent.alertsOffToast'));
    } else if (parent) {
      const r = await enableParentAlerts(parent);
      if (r === 'on') {
        setOn(true);
        onResult(true, t('parent.alertsOnToast'));
      } else {
        fx.error();
        Alert.alert(
          t('parent.alertsFailTitle'),
          r === 'denied' ? t('parent.alertsDenied') : r === 'unsupported' ? t('parent.alertsUnsupported') : r === 'notYetIos' ? t('parent.alertsNotYetIos') : t('parent.alertsError'),
        );
      }
    }
    setBusy(false);
  };

  return <ListRow first={first} icon="inbox" label={t('parent.alertsLabel')} sub={t('parent.alertsSub')} toggle={on} onPress={flip} />;
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingBottom: space.xxxl },
  pinHead: { paddingHorizontal: layout.gutter },
  content: { paddingHorizontal: layout.gutter, gap: layout.section },
  footer: { gap: space.lg, alignItems: 'center' },
  trust: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, alignSelf: 'stretch' },
  footnote: { flex: 1, color: color.text3, fontFamily: font.medium, ...type.small },
  deleteLink: { color: color.text3, fontFamily: font.semibold, ...type.small, textDecorationLine: 'underline' },
  remove: { color: color.danger, fontFamily: font.semibold, ...type.small },
}));
