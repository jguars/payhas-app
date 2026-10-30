import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { LaneBadge } from '@/components/LaneBadge';
import { Enter } from '@/components/motion/Enter';
import { PinPad } from '@/components/PinPad';
import { useToast } from '@/components/Toast';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useGoBack } from '@/lib/useGoBack';
import { useInsets } from '@/lib/useInsets';
import { color, font, iconSize, iconStroke, lane as lanes, layout, pageFill, radius, space, themedStyles, type } from '@/theme/tokens';

/**
 * Family: the parent's dashboard home, behind the PIN (15 minutes). What
 * needs an answer first, then one card per child with today's time and the
 * quick actions, then the account (the parent first). Built only from the
 * shared components (DESIGN.md → Components). A child's card opens their
 * page (parent-child.tsx).
 */
export default function FamilyScreen() {
  const { child: initial } = useLocalSearchParams<{ child?: string }>();
  const { token, unlocked, children, unlock, lock, reload, answer, setPaused, addTime } = useParent();
  const { signOut, profiles, plan } = useFamily();
  const { top, bottom } = useInsets();
  const toast = useToast();
  const goBack = useGoBack();
  const { t, lang } = useT();
  const [deletingAccount, setDeletingAccount] = useState(false);
  // Flags from the last day count as "needs you"; the cut-off is taken when the screen opens.
  const [now] = useState(() => Date.now());
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

  /** Report an action; Pause passes `undo` so a mis-tap is one tap to reverse. */
  const done = (ok: boolean, text: string, undo?: () => Promise<boolean>) => {
    if (!ok) {
      fx.error();
      toast({ text: t('parent.networkError'), icon: 'close' });
      return;
    }
    fx.success();
    toast({ text, icon: 'check', action: undo ? { label: t('parent.undo'), onPress: () => void undo() } : undefined });
  };

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
          <PageHeader back title={t('parent.title')} subtitle={t('parent.familyGlance')} />
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
          {children == null
            ? [0, 1].map((i) => <Card key={i} style={styles.skeleton}>{null}</Card>)
            : children.map((c) => (
                <ChildCard
                  key={c.id}
                  child={c}
                  avatar={avatarOf(c.id)}
                  onOpen={() => openChild(c)}
                  onPause={async () => {
                    const next = !c.paused;
                    done(await setPaused(c, next), t(next ? 'parent.pausedToast' : 'parent.resumedToast', { name: c.display_name }), () => setPaused(c, !next));
                  }}
                  onAddTime={async () => done(await addTime(c, 15), t('parent.addedTime', { count: 15, name: c.display_name }))}
                />
              ))}
          <ListGroup>
            <ListRow
              first
              icon="plus"
              label={t('parent.addChild')}
              sub={atLimit && !plan?.plus ? t('parent.thirdWithPlus') : undefined}
              value={atLimit && !plan?.plus ? <Badge label={t('plus.colPlus')} tone="plus" icon="sparkle" /> : undefined}
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
                value={plan.plus && plan.plus_until ? planDate(plan.plus_until) : t('plus.colFree')}
                onPress={() => router.push('/plus')}
              />
            )}
            <AlertsRow parent={token} first={adults.length === 0 && !plan} onResult={(text, ok) => done(ok, text)} />
            <ListRow
              icon="lock"
              label={t('parent.lock')}
              chevron={false}
              onPress={() => {
                lock();
                goBack();
              }}
            />
            <ListRow
              icon="close"
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
          </ListGroup>
        </Enter>

        <View style={styles.center}>
          <Button
            size="sm"
            variant="quiet"
            label={t('parent.deleteAccount')}
            onPress={() => confirmDestructive(t('parent.deleteTitle'), t('parent.deleteBody'), t('parent.deleteConfirm'), t('common.cancel'), () => setDeletingAccount(true))}
          />
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * One child, as a card (approved at Gate 2): who they are and what they're
 * doing, time used today in big type against the limit, and the three things
 * a parent does most — pause, add 15 minutes, open their rules.
 */
function ChildCard({ child, avatar, onOpen, onPause, onAddTime }: { child: Child; avatar: string | null; onOpen: () => void; onPause: () => void; onAddTime: () => void }) {
  const { t } = useT();
  const p = presence(child, t);
  const today = child.week[child.week.length - 1];
  const used = (today?.video_s ?? 0) + (today?.game_s ?? 0);
  const limit = child.daily_limit_minutes == null ? null : child.daily_limit_minutes + child.extra_minutes;
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
            <Text style={styles.status} numberOfLines={1}>
              {status}
            </Text>
          </View>
        </View>
        <Icon name="chevron" size={iconSize.sm} color={color.text3} strokeWidth={iconStroke(iconSize.sm)} />
      </Pressable>
      <View style={styles.usedRow}>
        <Text style={styles.used}>{minutes(t, used)}</Text>
        <Text style={styles.muted}>{limit ? t('parent.ofToday', { limit: minutes(t, limit * 60) }) : t('parent.noLimit')}</Text>
      </View>
      {limit != null && <ProgressBar progress={used / (limit * 60)} label={`${child.display_name}: ${minutes(t, used)} ${t('parent.ofToday', { limit: minutes(t, limit * 60) })}`} />}
      <View style={styles.actions}>
        <Button size="sm" variant="secondary" icon={child.paused ? 'play' : 'pause'} label={t(child.paused ? 'parent.resume' : 'parent.pauseShort')} accessibilityLabel={`${t(child.paused ? 'parent.resume' : 'parent.pauseShort')}: ${child.display_name}`} onPress={onPause} />
        {limit != null && <Button size="sm" variant="secondary" icon="plus" label={t('parent.addMin', { count: 15 })} accessibilityLabel={t('parent.addedTime', { count: 15, name: child.display_name })} onPress={onAddTime} />}
        <Button size="sm" variant="secondary" icon="chevron" label={t('parent.details')} accessibilityLabel={`${t('parent.details')}: ${child.display_name}`} onPress={onOpen} />
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
          r === 'denied' ? t('parent.alertsDenied') : r === 'unsupported' ? t('parent.alertsUnsupported') : t('parent.alertsError'),
        );
      }
    }
    setBusy(false);
  };

  return <ListRow first={first} icon="send" label={t('parent.alertsLabel')} sub={t('parent.alertsSub')} toggle={on} onPress={flip} />;
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingBottom: space.xxxl },
  pinHint: { color: color.text3, fontFamily: font.medium, ...type.small },
  pinHead: { paddingHorizontal: layout.gutter },
  content: { paddingHorizontal: layout.gutter, gap: layout.section },
  section: { gap: space.md },
  center: { alignItems: 'center' },
  skeleton: { height: 196, opacity: 0.5 },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1, gap: space.xs },
  name: { color: color.text, fontFamily: font.title, ...type.title },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  status: { flexShrink: 1, color: color.text2, fontFamily: font.medium, ...type.small },
  liveBadge: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface1 },
  usedRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space.sm },
  used: { color: color.text, fontFamily: font.display, ...type.display },
  muted: { color: color.text2, fontFamily: font.medium, ...type.body },
  cardTitle: { color: color.text, fontFamily: font.semibold, ...type.body },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
}));
