import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { PinPad } from '@/components/PinPad';
import { useToast, useToastFlush } from '@/components/Toast';
import { Avatar } from '@/components/ui/Avatar';
import { ListGroup, ListRow } from '@/components/ui/List';
import { PageHeader } from '@/components/ui/PageHeader';
import { Profile, useFamily } from '@/features/family/FamilyProvider';
import { useLinkedPhones } from '@/features/parent/devices';
import { JoinRequestRow } from '@/features/parent/joinRequests';
import { confirmDestructive } from '@/features/parent/parts';
import { disableParentAlerts, enableParentAlerts, storedPushToken } from '@/features/parent/push';
import { useParent } from '@/features/parent/useParent';
import { planDate } from '@/features/plan/plan';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useGoBack } from '@/lib/useGoBack';
import { useInsets } from '@/lib/useInsets';
import { border, color, font, iconSize, iconStroke, layout, pageFill, radius, space, themedStyles, type } from '@/theme/tokens';

/** Avatar size on a person's tile. */
const TILE_AVATAR = 72;

/**
 * Family: the parent's home, behind the PIN (15 minutes). A clean hub
 * (approved 2026-10-31): a tile per person — avatar and name only — opening
 * that person's own page (a child: parent-child.tsx with today, rules, their
 * phone, the week; a grown-up: their profile). Under the people, what used to
 * be Family settings: shared phones and co-parents, the plan and this phone,
 * and — quietest of all — deleting the account.
 */
export default function FamilyScreen() {
  const { child: initial } = useLocalSearchParams<{ child?: string }>();
  const { token, unlocked, unlock, lock, reload } = useParent();
  const { profiles, plan, signOut } = useFamily();
  const linked = useLinkedPhones(token);
  const flush = useToastFlush();
  const toast = useToast();
  const goBack = useGoBack();
  const { top, bottom } = useInsets();
  const { t } = useT();
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Back from a person's page, a phone link or Payhas Plus: show what changed there.
  useFocusEffect(
    useCallback(() => {
      if (unlocked) {
        reload();
        linked.reload();
      }
    }, [unlocked, reload, linked.reload]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Opened for one child (their Me tab, an alert): straight on to their page, once.
  const openedFor = useRef(false);
  useEffect(() => {
    if (!unlocked || !initial || openedFor.current) return;
    openedFor.current = true;
    router.push({ pathname: '/parent-child', params: { id: initial } });
  }, [unlocked, initial]);

  if (!unlocked || deletingAccount) {
    return (
      <View style={styles.root}>
        <View style={[styles.pinHead, { paddingTop: top + space.sm }]}>
          <PageHeader back title={deletingAccount ? t('parent.deleteAccount') : t('parent.title')} />
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
            <>
              <PinPad title={t('common.parentPin')} onComplete={unlock} onCancel={() => goBack()} />
              <Text style={styles.pinHint}>{t('parent.pinHint')}</Text>
            </>
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

  // Children first, then the grown-ups with the parent last.
  const people = [...profiles.filter((p) => p.lane !== 'adult'), ...profiles.filter((p) => p.lane === 'adult').sort((a, b) => Number(a.is_parent) - Number(b.is_parent))];
  const atLimit = !!plan && profiles.length >= plan.profile_limit;
  const openPerson = (p: Profile) =>
    p.lane === 'adult' ? router.push({ pathname: '/profile-edit', params: { id: p.id } }) : router.push({ pathname: '/parent-child', params: { id: p.id } });
  // Children's phones are on each child's page; here only shared phones and co-parents.
  const others = (linked.phones ?? []).filter((ph) => ph.kind !== 'child');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + space.sm, paddingBottom: bottom + space.xxl }]} showsVerticalScrollIndicator={false}>
        <Enter index={0}>
          <PageHeader back title={t('parent.title')} />
        </Enter>

        <JoinRequestRow />

        <View style={styles.grid}>
          {people.map((p, i) => (
            <Enter key={p.id} index={1 + i} style={styles.tileWrap}>
              <PressScale onPress={() => openPerson(p)} accessibilityRole="button" accessibilityLabel={p.is_parent ? t('parent.you', { name: p.display_name }) : p.display_name} style={styles.tile}>
                <Avatar name={p.display_name} avatar={p.avatar} lane={p.lane} size={TILE_AVATAR} />
                <Text style={styles.tileName} numberOfLines={1}>
                  {p.display_name}
                </Text>
              </PressScale>
            </Enter>
          ))}
          {/* At the plan's profile limit on Free, Add opens Payhas Plus instead. */}
          {(!atLimit || !plan?.plus) && (
            <Enter index={1 + people.length} style={styles.tileWrap}>
              <PressScale onPress={() => router.push(atLimit ? '/plus' : '/add-child')} accessibilityRole="button" style={[styles.tile, styles.addTile]}>
                <View style={styles.addCircle}>
                  <Icon name="plus" size={iconSize.lg} color={color.text2} strokeWidth={iconStroke(iconSize.lg)} />
                </View>
                <Text style={[styles.tileName, styles.addName]} numberOfLines={1}>
                  {t('parent.addChild')}
                </Text>
              </PressScale>
            </Enter>
          )}
        </View>

        <Enter index={2 + people.length}>
          <ListGroup title={t('parent.phonesTitle')}>
            {others.map((ph, i) => (
              <ListRow
                key={ph.id}
                first={i === 0}
                icon="link"
                label={ph.name}
                sub={ph.status === 'pending' ? t('parent.phoneWaiting') : ph.kind === 'coparent' ? `${t('parent.coParent')} · ${ph.phone ?? ''}` : t('parent.sharedPhone')}
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

        <Enter index={3 + people.length}>
          <ListGroup title={t('parent.planPhone')}>
            {plan && (
              <ListRow first icon="sparkle" label={t('plus.title')} value={plan.plus && plan.plus_until ? planDate(plan.plus_until) : t('parent.freePlan')} onPress={() => router.push('/plus')} />
            )}
            <AlertsRow parent={token} first={!plan} onResult={done} />
            <ListRow
              icon="lock"
              label={t('parent.lock')}
              chevron={false}
              onPress={async () => {
                await flush(); // send a waiting +15 while the session is still open
                lock();
                goBack();
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
  pinHint: { color: color.text3, fontFamily: font.medium, ...type.small },
  pinHead: { paddingHorizontal: layout.gutter },
  content: { paddingHorizontal: layout.gutter, gap: layout.section },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  tileWrap: { width: '48%' },
  tile: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg, paddingHorizontal: space.md, borderRadius: radius.card, backgroundColor: color.surface1 },
  tileName: { color: color.text, fontFamily: font.semibold, ...type.body, maxWidth: '100%' },
  addTile: { backgroundColor: 'transparent', borderWidth: border.strong, borderStyle: 'dashed', borderColor: color.line },
  addCircle: { width: TILE_AVATAR, height: TILE_AVATAR, borderRadius: radius.pill, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  addName: { color: color.text2 },
  remove: { color: color.danger, fontFamily: font.semibold, ...type.small },
  footer: { gap: space.lg, alignItems: 'center' },
  trust: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, alignSelf: 'stretch' },
  footnote: { flex: 1, color: color.text3, fontFamily: font.medium, ...type.small },
  deleteLink: { color: color.text3, fontFamily: font.semibold, ...type.small, textDecorationLine: 'underline' },
}));
