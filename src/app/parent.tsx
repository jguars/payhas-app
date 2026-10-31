import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { LaneBadge } from '@/components/LaneBadge';
import { Enter } from '@/components/motion/Enter';
import { PinPad } from '@/components/PinPad';
import { useToast } from '@/components/Toast';
import { AvatarSwitcher } from '@/components/ui/AvatarSwitcher';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ListGroup, ListRow } from '@/components/ui/List';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useFamily } from '@/features/family/FamilyProvider';
import { confirmDestructive, LiveDot, LockedHistory, WeekChart } from '@/features/parent/parts';
import { LinkedPhone, useLinkedPhones } from '@/features/parent/devices';
import { JoinRequestRow } from '@/features/parent/joinRequests';
import { RecentStrip } from '@/features/parent/RecentStrip';
import { ago, Child, minutes, presence, useParent } from '@/features/parent/useParent';
import { localized, roleKey, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { useGoBack } from '@/lib/useGoBack';
import { useInsets } from '@/lib/useInsets';
import { color, control, font, iconSize, iconStroke, lane as lanes, layout, pageFill, space, themedStyles, type } from '@/theme/tokens';

/**
 * Family: the parent's dashboard home, behind the PIN (15 minutes). Family C
 * (approved 2026-10-31): the children in a row of avatars, and the one picked
 * shown in full — what needs an answer, today with pause / +15 / rules, the
 * week and what they watched. The account lives behind the settings button
 * (parent-settings.tsx); rules and hiding videos on the child's page
 * (parent-child.tsx). Built only from the shared components.
 */
export default function FamilyScreen() {
  const { child: initial } = useLocalSearchParams<{ child?: string }>();
  const { token, unlocked, children, plus, failed, unlock, reload, answer, setPaused, previewExtra, grantExtra } = useParent();
  const linked = useLinkedPhones(token);
  const childrenRef = useRef(children);
  childrenRef.current = children;
  const { profiles, plan } = useFamily();
  const { top, bottom } = useInsets();
  const toast = useToast();
  const goBack = useGoBack();
  const { t, lang } = useT();
  // Opened from a child's Me tab (?child=id) that child shows first; a tap on another switches.
  const [picked, setPicked] = useState<string | null>(null);
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
      if (unlocked) {
        reload();
        linked.reload();
      }
    }, [unlocked, reload, linked.reload]), // eslint-disable-line react-hooks/exhaustive-deps
  );

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

  const avatarOf = (id: string) => profiles.find((p) => p.id === id)?.avatar ?? null;
  const flagsOf = (c: Child) => c.flags.filter((f) => new Date(f.at).getTime() > dayAgo);
  const atLimit = !!plan && profiles.length >= plan.profile_limit;
  const openChild = (c: Child) => router.push({ pathname: '/parent-child', params: { id: c.id } });
  const addChild = () => router.push(atLimit && !plan?.plus ? '/plus' : '/add-child');
  // The child on show: the one picked, else the one we were opened for, else the first.
  const child = children?.find((c) => c.id === (picked ?? initial)) ?? children?.[0] ?? null;
  const flags = child ? flagsOf(child) : [];

  const onPause = async (c: Child) => {
    const next = !c.paused;
    done(await setPaused(c, next), t(next ? 'parent.pausedToast' : 'parent.resumedToast', { name: c.display_name }), async () => {
      const now = latest(c.id);
      return now ? setPaused(now, !next) : false;
    });
  };
  const onAddTime = async (c: Child) => {
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
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + space.sm, paddingBottom: bottom + space.xxl }]} showsVerticalScrollIndicator={false}>
        <Enter index={0} style={styles.section}>
          <PageHeader back title={t('parent.title')} right={<IconButton icon="sliders" label={t('parent.settings')} onPress={() => router.push('/parent-settings')} />} />
          {children != null && (
            <AvatarSwitcher
              items={children.map((c) => ({
                id: c.id,
                name: c.display_name,
                avatar: avatarOf(c.id),
                lane: c.lane,
                alert: !!c.request || flagsOf(c).length > 0,
                alertLabel: t('parent.needsYouA11y'),
              }))}
              selected={child?.id ?? null}
              onSelect={setPicked}
              addLabel={t('parent.addShort')}
              onAdd={addChild}
            />
          )}
        </Enter>

        <JoinRequestRow />

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
        ) : !child ? (
          <Card>
            <EmptyState icon="plus" title={t('parent.noChildrenTitle')} body={t('parent.noChildrenBody')} action={t('parent.addChild')} onAction={addChild} />
          </Card>
        ) : (
          // Keyed by child, so switching replays the entrance and resets the buttons' busy state.
          <View key={child.id} style={styles.panel}>
            {(child.request || flags.length > 0) && (
              <Enter index={1} style={styles.section}>
                {child.request && (
                  <Card>
                    <Text style={styles.cardTitle}>
                      {t('parent.asking', { name: child.display_name })} <Text style={styles.muted}>· {ago(t, Math.max(1, Math.round((now - new Date(child.request.created_at).getTime()) / 60_000)))}</Text>
                    </Text>
                    <View style={styles.actions}>
                      {[15, 30].map((m) => (
                        <Button
                          key={m}
                          size="sm"
                          variant="secondary"
                          icon="plus"
                          label={t('parent.addMin', { count: m })}
                          onPress={async () => done(await answer(child, m), t('parent.addedTime', { count: m, name: child.display_name }))}
                        />
                      ))}
                      <Button size="sm" variant="quiet" label={t('parent.notToday')} onPress={async () => done(await answer(child, null), t('parent.toldNotToday', { name: child.display_name }))} />
                    </View>
                  </Card>
                )}
                {flags.length > 0 && (
                  <ListGroup>
                    {flags.map((flag, i) => (
                      <ListRow
                        key={flag.video_id + flag.at}
                        first={i === 0}
                        icon="flag"
                        danger
                        label={t('parent.flaggedRow', { name: child.display_name })}
                        sub={localized(lang, flag.caption, flag.caption_i18n)}
                        onPress={() => openChild(child)}
                      />
                    ))}
                  </ListGroup>
                )}
              </Enter>
            )}

            <Enter index={2} style={styles.section}>
              <TodayCard child={child} onPause={() => onPause(child)} onAddTime={() => onAddTime(child)} onRules={() => openChild(child)} />
              <PhoneRows child={child} phones={linked.phones} onRemove={linked.remove} />
            </Enter>

            {plus === false ? (
              <Enter index={3}>
                <LockedHistory />
              </Enter>
            ) : (
              <>
                <Enter index={3}>
                  <WeekChart child={child} />
                </Enter>
                {child.recent.some((r) => !r.hidden) && (
                  <Enter index={4} style={styles.section}>
                    <SectionHeader title={t('parent.recentlyWatched')} action={t('parent.seeAll')} onAction={() => openChild(child)} />
                    <RecentStrip child={child} onOpen={() => openChild(child)} />
                  </Enter>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * The child's own phone (linked phones, flow D): the one place a child's phone
 * is linked and removed — the phone and when it was last used, with Remove,
 * or "Not linked yet" with Link.
 */
function PhoneRows({ child, phones, onRemove }: { child: Child; phones: LinkedPhone[] | null; onRemove: (id: string) => Promise<boolean> }) {
  const { t } = useT();
  const toast = useToast();
  if (!phones) return null;
  const mine = phones.filter((p) => p.profile_id === child.id);
  const name = child.display_name;
  const remove = (p: LinkedPhone) =>
    confirmDestructive(t('parent.removePhoneTitle', { name: p.name }), t('parent.removePhoneBody'), t('parent.removePhone'), t('common.cancel'), async () => {
      if (!(await onRemove(p.id))) {
        fx.error();
        return toast({ text: t('parent.networkError'), icon: 'close' });
      }
      fx.success();
      toast({ text: t('parent.removedToast', { name: p.name }), icon: 'check' });
    });
  return (
    <ListGroup>
      {mine.length === 0 ? (
        <ListRow
          first
          icon="link"
          label={t('parent.phoneOf', { name })}
          sub={t('parent.phoneNotLinked')}
          value={<Button size="sm" variant="secondary" label={t('parent.phoneLink')} onPress={() => router.push({ pathname: '/link-phone', params: { profile: child.id, name } })} />}
          chevron={false}
        />
      ) : (
        mine.map((p, i) => (
          <ListRow
            key={p.id}
            first={i === 0}
            icon="link"
            label={p.name}
            sub={
              p.status === 'pending'
                ? t('parent.phoneWaiting')
                : `${t('parent.phoneOf', { name })}${p.last_seen_at ? ` · ${ago(t, Math.round((Date.now() - new Date(p.last_seen_at).getTime()) / 60_000))}` : ''}`
            }
            value={<Button size="sm" variant="secondary" label={t('parent.removePhone')} onPress={() => remove(p)} />}
            chevron={false}
          />
        ))
      )}
    </ListGroup>
  );
}

/**
 * The picked child's today (Family C): lane and what they're doing now, time
 * used in big type against the limit (over the limit and no-time-today said
 * in words), and the three things a parent does from here — pause, add 15
 * minutes, and open their rules.
 */
function TodayCard({ child, onPause, onAddTime, onRules }: { child: Child; onPause: () => Promise<unknown>; onAddTime: () => Promise<unknown>; onRules: () => void }) {
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
  return (
    <Card>
      {/* The card names whose day it is: once the avatars scroll away, the numbers still have an owner. */}
      <View style={styles.statusRow}>
        <View style={styles.who}>
          <Text style={styles.name} numberOfLines={1}>
            {child.display_name}
          </Text>
          <LaneBadge lane={child.lane} label={`${t(roleKey(child))} · ${lanes[child.lane].ages}`} />
        </View>
        <View style={styles.presence}>
          {child.paused ? <Badge label={t('parent.paused')} icon="pause" /> : p.live && <LiveDot />}
          {!child.paused && (
            <Text style={[styles.status, p.live && { color: color.success }]} numberOfLines={1}>
              {p.text}
            </Text>
          )}
        </View>
      </View>
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
          <Button size="sm" block variant="secondary" icon={child.paused ? 'play' : 'pause'} label={t(child.paused ? 'parent.resume' : 'parent.pauseShort')} accessibilityLabel={`${t(child.paused ? 'parent.resume' : 'parent.pauseShort')}: ${child.display_name}`} loading={pauseBusy} onPress={once(pauseBusy, setPauseBusy, onPause)} />
        </View>
        {limit != null && (
          <View style={styles.action}>
            <Button size="sm" block variant="secondary" icon="plus" label={t('parent.addMin', { count: 15 })} accessibilityLabel={t('parent.addTimeA11y', { name: child.display_name })} disabled={addBusy} onPress={once(addBusy, setAddBusy, onAddTime)} />
          </View>
        )}
        <View style={styles.action}>
          <Button size="sm" block variant="secondary" icon="clock" label={t('parent.rules')} accessibilityLabel={`${t('parent.rules')}: ${child.display_name}`} onPress={onRules} />
        </View>
      </View>
    </Card>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingBottom: space.xxxl },
  pinHint: { color: color.text3, fontFamily: font.medium, ...type.small },
  pinHead: { paddingHorizontal: layout.gutter },
  content: { paddingHorizontal: layout.gutter, gap: layout.section },
  section: { gap: space.md },
  panel: { gap: layout.section },
  stale: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  staleText: { flex: 1, color: color.text2, fontFamily: font.medium, ...type.small },
  skeleton: { height: control.lg * 3, opacity: 0.5 },
  // Wraps rather than truncates: Turkmen and Russian status lines are long.
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: space.sm, rowGap: space.xs },
  presence: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  name: { flexShrink: 1, color: color.text, fontFamily: font.title, ...type.title },
  status: { flexShrink: 1, color: color.text2, fontFamily: font.medium, ...type.small },
  usedRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space.sm },
  used: { color: color.text, fontFamily: font.display, ...type.display },
  muted: { color: color.text2, fontFamily: font.medium, ...type.body },
  cardTitle: { color: color.text, fontFamily: font.semibold, ...type.body },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  action: { flex: 1 },
}));
