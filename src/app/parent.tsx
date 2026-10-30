import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { LaneBadge } from '@/components/LaneBadge';
import { Enter } from '@/components/motion/Enter';
import { PinPad } from '@/components/PinPad';
import { useToast, useToastFlush } from '@/components/Toast';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListGroup, ListRow } from '@/components/ui/List';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useFamily } from '@/features/family/FamilyProvider';
import { confirmDestructive, LiveDot } from '@/features/parent/parts';
import { disableParentAlerts, enableParentAlerts, storedPushToken } from '@/features/parent/push';
import { ago, Child, minutes, presence, useParent } from '@/features/parent/useParent';
import { planDate } from '@/features/plan/plan';
import { localized, roleKey, useT } from '@/i18n';
import { formatDay } from '@/i18n/format';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useGoBack } from '@/lib/useGoBack';
import { useInsets } from '@/lib/useInsets';
import { color, control, font, iconSize, iconStroke, lane as lanes, layout, pageFill, radius, space, themedStyles, type } from '@/theme/tokens';

/**
 * Family: the parent's dashboard home, behind the PIN (15 minutes). What
 * needs an answer first, then one card per child with today's time and the
 * quick actions, then the account (the parent first). Built only from the
 * shared components (DESIGN.md → Components). A child's card opens their
 * page (parent-child.tsx).
 */
export default function FamilyScreen() {
  const { child: initial } = useLocalSearchParams<{ child?: string }>();
  const { token, unlocked, children, failed, unlock, lock, reload, answer, setPaused, previewExtra, grantExtra } = useParent();
  const flush = useToastFlush();
  const childrenRef = useRef(children);
  childrenRef.current = children;
  const { signOut, profiles, plan } = useFamily();
  const { top, bottom } = useInsets();
  const toast = useToast();
  const goBack = useGoBack();
  const { t, lang } = useT();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // Flags from the last day count as "needs you"; the cut-off is taken when the screen opens.
  // Ticks with the 20 s refresh so request ages and the 24 h flag window stay true.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);
  const dayAgo = now - 24 * 3600_000;

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
        <View style={[styles.pinHead, { paddingTop: top + space.sm }]}>
          <PageHeader back title={t('parent.title')} />
        </View>
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
        <View style={[styles.pinHead, { paddingTop: top + space.sm }]}>
          <PageHeader back title={t('parent.deleteAccount')} />
        </View>
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

  const failToast = (key: 'parent.networkError' | 'parent.undoFailed' | 'parent.sessionExpired') => {
    fx.error();
    toast({ text: t(key), icon: 'close' });
  };
  /** Report an action; Pause passes `undo` so a mis-tap is one tap to reverse. */
  const done = (ok: boolean, text: string, undo?: () => Promise<boolean>) => {
    if (!ok) return failToast('parent.networkError');
    fx.success();
    toast({ text, icon: 'check', action: undo ? { label: t('parent.undo'), onPress: async () => !(await undo()) && failToast('parent.undoFailed') } : undefined });
  };
  /** The child as the list holds them now — undo must start from the current state, not the one at tap time. */
  const latest = (id: string) => childrenRef.current?.find((c) => c.id === id);

  const adults = profiles.filter((p) => p.lane === 'adult').sort((a, b) => Number(b.is_parent) - Number(a.is_parent));
  const avatarOf = (id: string) => profiles.find((p) => p.id === id)?.avatar ?? null;
  const requests = (children ?? []).filter((c) => c.request);
  const flags = (children ?? []).flatMap((c) => c.flags.filter((f) => new Date(f.at).getTime() > dayAgo).map((f) => ({ child: c, flag: f })));
  const atLimit = !!plan && profiles.length >= plan.profile_limit;
  const openChild = (c: Child) => router.push({ pathname: '/parent-child', params: { id: c.id } });

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + space.sm, paddingBottom: bottom + space.xxl }]} showsVerticalScrollIndicator={false}>
        <Enter index={0}>
          <PageHeader back title={t('parent.title')} subtitle={formatDay(lang, new Date(now))} />
        </Enter>

        {(requests.length > 0 || flags.length > 0) && (
          <Enter index={1} style={styles.section}>
            <SectionHeader title={t('parent.needsYou')} />
            {requests.map((c) => (
              <Card key={c.id}>
                <Text style={styles.cardTitle}>
                  {t('parent.asking', { name: c.display_name })} <Text style={styles.muted}>· {ago(t, Math.max(1, Math.round((now - new Date(c.request!.created_at).getTime()) / 60_000)))}</Text>
                </Text>
                <View style={styles.actions}>
                  {[15, 30].map((m) => (
                    <Button
                      key={m}
                      size="sm"
                      variant="secondary"
                      icon="plus"
                      label={t('parent.addMin', { count: m })}
                      onPress={async () => done(await answer(c, m), t('parent.addedTime', { count: m, name: c.display_name }))}
                    />
                  ))}
                  <Button size="sm" variant="quiet" label={t('parent.notToday')} onPress={async () => done(await answer(c, null), t('parent.toldNotToday', { name: c.display_name }))} />
                </View>
              </Card>
            ))}
            {flags.length > 0 && (
              <ListGroup>
                {flags.map(({ child: c, flag }, i) => (
                  <ListRow
                    key={c.id + flag.at}
                    first={i === 0}
                    icon="flag"
                    danger
                    label={t('parent.flaggedRow', { name: c.display_name })}
                    sub={localized(lang, flag.caption, flag.caption_i18n)}
                    onPress={() => openChild(c)}
                  />
                ))}
              </ListGroup>
            )}
          </Enter>
        )}

        <Enter index={2} style={styles.section}>
          {children != null && failed && (
            <View style={styles.stale}>
              <Icon name="help" size={iconSize.sm} color={color.warning} strokeWidth={iconStroke(iconSize.sm)} />
              <Text style={styles.staleText}>{t('parent.staleData')}</Text>
            </View>
          )}
          {children == null && failed && !retrying ? (
            <Card>
              <EmptyState
                icon="help"
                title={t('parent.loadFailed')}
                body={t('parent.loadFailedSub')}
                action={t('parent.retry')}
                onAction={async () => {
                  setRetrying(true);
                  await reload();
                  setRetrying(false);
                }}
              />
            </Card>
          ) : children == null ? (
            <Card style={styles.skeleton}>{null}</Card>
          ) : (
            children.map((c) => (
                <ChildCard
                  key={c.id}
                  child={c}
                  avatar={avatarOf(c.id)}
                  onOpen={() => openChild(c)}
                  onPause={async () => {
                    const next = !c.paused;
                    done(await setPaused(c, next), t(next ? 'parent.pausedToast' : 'parent.resumedToast', { name: c.display_name }), async () => {
                      const now = latest(c.id);
                      return now ? setPaused(now, !next) : false;
                    });
                  }}
                  onAddTime={async () => {
                    // A pending request is answered by the same +15, so it never stays "asking".
                    if (c.request) return done(await answer(c, 15), t('parent.addedTime', { count: 15, name: c.display_name }));
                    // Shown on the card at once; sent when the Undo window ends (or earlier: lock, sign-out,
                    // background), so undoing costs nothing and the child never sees a grant taken back.
                    // The card stays busy until it's sent or undone — no double grants.
                    previewExtra(c.id, 15);
                    fx.success();
                    await new Promise<void>((resolve) =>
                      toast({
                        text: t('parent.addedTime', { count: 15, name: c.display_name }),
                        icon: 'check',
                        action: {
                          label: t('parent.undo'),
                          onPress: () => {
                            previewExtra(c.id, -15);
                            resolve();
                          },
                        },
                        onDismiss: async () => {
                          const res = await grantExtra(c.id, 15);
                          if (res !== 'ok') {
                            previewExtra(c.id, -15);
                            failToast(res === 'expired' ? 'parent.sessionExpired' : 'parent.networkError');
                          }
                          resolve();
                        },
                      }),
                    );
                  }}
                />
              ))
          )}
          <ListGroup>
            <ListRow
              first
              icon="plus"
              label={t('parent.addChild')}
              sub={atLimit && !plan?.plus ? t('parent.thirdWithPlus') : undefined}
              value={atLimit && !plan?.plus ? <Badge label={t('plus.colPlus')} tone="plus" icon="sparkle" /> : undefined}
              chevron={!(atLimit && !plan?.plus)}
              onPress={() => router.push(atLimit ? '/plus' : '/add-child')}
            />
          </ListGroup>
        </Enter>

        <Enter index={3}>
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
            <AlertsRow parent={token} first={adults.length === 0 && !plan} onResult={(text, ok) => done(ok, text)} />
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

/**
 * One child, as a card (approved at Gate 2): who they are and what they're
 * doing, time used today in big type against the limit (over the limit and
 * no-time-today said in words), and the two things a parent does most —
 * pause and add 15 minutes. The header opens their page.
 */
function ChildCard({ child, avatar, onOpen, onPause, onAddTime }: { child: Child; avatar: string | null; onOpen: () => void; onPause: () => Promise<unknown>; onAddTime: () => Promise<unknown> }) {
  const { t } = useT();
  // One run at a time per button: a double tap can't grant 30 minutes or answer a request twice.
  // Separate per button, so Pause stays usable while +15 waits out its Undo window.
  const [pauseBusy, setPauseBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const once = (busy: boolean, set: (b: boolean) => void, run: () => Promise<unknown>) => async () => {
    if (busy) return;
    set(true);
    await run();
    set(false);
  };
  const p = presence(child, t);
  const today = child.week[child.week.length - 1];
  const used = (today?.video_s ?? 0) + (today?.game_s ?? 0);
  const limit = child.daily_limit_minutes == null ? null : child.daily_limit_minutes + child.extra_minutes;
  const over = limit != null && limit > 0 && used > limit * 60;
  const status = child.paused ? t('parent.paused') : p.text;
  return (
    <Card>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${child.display_name}, ${t(roleKey(child))}. ${status}`} style={styles.who}>
        <View>
          <Avatar name={child.display_name} avatar={avatar} lane={child.lane} size={56} />
          {p.live && !child.paused && (
            <View style={styles.liveBadge}>
              <LiveDot />
            </View>
          )}
        </View>
        <View style={styles.grow}>
          <Text style={styles.name} numberOfLines={1}>
            {child.display_name}
          </Text>
          <View style={styles.statusRow}>
            <LaneBadge lane={child.lane} label={`${t(roleKey(child))} · ${lanes[child.lane].ages}`} />
            {child.paused && <Badge label={t('parent.paused')} icon="pause" />}
          </View>
          {/* Its own line, so the one live fact is never cut off (long lane names, Turkmen). */}
          {!child.paused && (
            <Text style={styles.status} numberOfLines={1}>
              {status}
            </Text>
          )}
        </View>
        <Icon name="chevron" size={iconSize.sm} color={color.text3} strokeWidth={iconStroke(iconSize.sm)} />
      </Pressable>
      <View style={styles.usedRow}>
        <Text style={styles.used}>{minutes(t, used)}</Text>
        <Text style={[styles.muted, over && { color: color.danger }]}>
          {limit == null
            ? t('parent.noLimit')
            : limit === 0
              ? t('parent.noTimeToday')
              : over
                ? t('parent.overBy', { time: minutes(t, used - limit * 60) })
                : t('parent.ofToday', { limit: minutes(t, limit * 60) })}
        </Text>
      </View>
      {limit != null && limit > 0 && <ProgressBar progress={used / (limit * 60)} label={`${child.display_name}: ${minutes(t, used)} ${t('parent.ofToday', { limit: minutes(t, limit * 60) })}`} />}
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button size="md" block variant="secondary" icon={child.paused ? 'play' : 'pause'} label={t(child.paused ? 'parent.resume' : 'parent.pauseShort')} accessibilityLabel={`${t(child.paused ? 'parent.resume' : 'parent.pauseShort')}: ${child.display_name}`} loading={pauseBusy} onPress={once(pauseBusy, setPauseBusy, onPause)} />
        </View>
        {limit != null && (
          <View style={styles.action}>
            <Button size="md" block variant="secondary" icon="plus" label={t('parent.addMin', { count: 15 })} accessibilityLabel={t('parent.addTimeA11y', { name: child.display_name })} disabled={addBusy} onPress={once(addBusy, setAddBusy, onAddTime)} />
          </View>
        )}
      </View>
    </Card>
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
  section: { gap: space.md },
  footer: { gap: space.lg, alignItems: 'center' },
  stale: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  staleText: { flex: 1, color: color.text2, fontFamily: font.medium, ...type.small },
  trust: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, alignSelf: 'stretch' },
  footnote: { flex: 1, color: color.text3, fontFamily: font.medium, ...type.small },
  deleteLink: { color: color.text3, fontFamily: font.semibold, ...type.small, textDecorationLine: 'underline' },
  skeleton: { height: control.lg * 3, opacity: 0.5 },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1, gap: space.xs },
  name: { color: color.text, fontFamily: font.title, ...type.title },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  status: { flexShrink: 1, color: color.text2, fontFamily: font.medium, ...type.small },
  liveBadge: { position: 'absolute', right: -2, bottom: -2, width: iconSize.md, height: iconSize.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface1 },
  usedRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space.sm },
  used: { color: color.text, fontFamily: font.display, ...type.display },
  muted: { color: color.text2, fontFamily: font.medium, ...type.body },
  cardTitle: { color: color.text, fontFamily: font.semibold, ...type.body },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  action: { flex: 1 },
}));
