import { useLocalSearchParams } from 'expo-router';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextStyle, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon, IconName } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { Toggle } from '@/components/motion/Toggle';
import { PinPad } from '@/components/PinPad';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import { Avatar } from '@/components/ui/Avatar';
import { IconCircle } from '@/components/ui/IconCircle';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useFamily } from '@/features/family/FamilyProvider';
import { reasonLabel } from '@/features/creator/useReviewQueue';
import { mediaFor, signMedia } from '@/features/feed/data';
import { hourLabel, inQuietHours } from '@/features/library/useScreenTime';
import { disableParentAlerts, enableParentAlerts, storedPushToken } from '@/features/parent/push';
import { ago, Child, Controls, minutes, presence, RecentRow, useParent } from '@/features/parent/useParent';
import { laneKey, localized, topicLabel, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useInsets } from '@/lib/useInsets';
import { useGoBack } from '@/lib/useGoBack';
import { spring } from '@/theme/motion';
import { alpha, color, font, lane as lanes, radius, space } from '@/theme/tokens';

const GREEN = color.success;
const YELLOW = color.warning;
const RED = color.danger;
const LIMITS: (number | null)[] = [null, 15, 30, 45, 60, 90, 120];
/** Latest rows shown before "See all". */
const LATEST_FOLD = 5;

/**
 * The parent's remote: one PIN opens 15 minutes of control over every child
 * profile. Changes apply on the child's device within a second or two.
 */
export default function ParentScreen() {
  const { child: initial } = useLocalSearchParams<{ child?: string }>();
  const { token, unlocked, children, unlock, lock, reload, setControls, setPaused, addTime, answer, hideVideo } = useParent();
  const { bottom } = useInsets();
  const toast = useToast();
  const goBack = useGoBack();
  const { signOut, profiles, refresh } = useFamily();
  const [selected, setSelected] = useState<string | undefined>(initial);
  const [hiding, setHiding] = useState<RecentRow | null>(null);
  /** What a confirmed delete is waiting on the PIN for: the whole account, or one child's profile. */
  const [deleting, setDeleting] = useState<'account' | Child | null>(null);
  const { t, lang } = useT();

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

  // Deleting asks for the PIN again, even inside an open parent session.
  if (deleting) {
    const target = deleting;
    const confirmDelete = async (pin: string) => {
      if (target === 'account') {
        const { data, error } = await supabase.rpc('delete_account', { p_pin: pin });
        if (error) return error.message;
        if (!data) return false;
        toast({ text: t('parent.deletedToast'), icon: 'check' });
        lock();
        await disableParentAlerts().catch(() => {});
        await signOut();
        return true;
      }
      const { data, error } = await supabase.rpc('delete_profile', { p_pin: pin, p_profile_id: target.id });
      if (error) return error.message;
      if (!data) return false;
      toast({ text: t('parent.profileDeletedToast', { name: target.display_name }), icon: 'check' });
      setDeleting(null);
      setSelected(undefined);
      await Promise.all([reload(), refresh()]);
      return true;
    };
    return (
      <View style={styles.root}>
        <ScreenHeader title={target === 'account' ? t('parent.deleteAccount') : t('parent.deleteProfile', { name: target.display_name })} />
        <View style={styles.pinWrap}>
          <PinPad title={t('parent.deletePinTitle')} onComplete={confirmDelete} onCancel={() => setDeleting(null)} />
        </View>
      </View>
    );
  }

  const child = children?.find((c) => c.id === selected) ?? children?.[0];
  /** The dashboard RPC doesn't carry avatars; the family list already has them. */
  const avatarOf = (id: string) => profiles.find((p) => p.id === id)?.avatar ?? null;

  const done = (ok: boolean, text: string) => {
    if (!ok) {
      fx.error();
      toast({ text: t('parent.networkError'), icon: 'close' });
      return;
    }
    fx.success();
    toast({ text, icon: 'check' });
  };

  const change = async (c: Child, next: Partial<Controls>, text: string) => {
    const ok = await setControls(c, {
      daily_limit_minutes: c.daily_limit_minutes,
      quiet_hours: c.quiet_hours,
      bedtime_hour: c.bedtime_hour,
      wake_hour: c.wake_hour,
      games_enabled: c.games_enabled,
      ...next,
    });
    done(ok, text);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('parent.title')} />

      {children && children.length === 0 && (
        <Enter index={0} style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('parent.emptyTitle')}</Text>
          <Text style={styles.emptySub}>{t('parent.emptySub')}</Text>
          <AccountActions onLock={() => { lock(); goBack(); }} onSignOut={() => { lock(); signOut(); }} onDelete={() => setDeleting('account')} />
        </Enter>
      )}

      {child && (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + space.xxl }]} showsVerticalScrollIndicator={false}>
          {children!.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picker}>
              {children!.map((c) => {
                const on = c.id === child.id;
                const L = lanes[c.lane];
                return (
                  <PressScale
                    key={c.id}
                    onPress={() => {
                      if (!on) fx.tab();
                      setSelected(c.id);
                    }}
                    pressedScale={0.94}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[styles.pick, on && { borderColor: L.color, backgroundColor: L.color + '1F' }]}
                  >
                    <Avatar name={c.display_name} avatar={avatarOf(c.id)} lane={c.lane} size={32} />
                    <Text style={[styles.pickName, on && { color: color.text }]}>{c.display_name}</Text>
                    {presence(c, t).live && <LiveDot />}
                  </PressScale>
                );
              })}
            </ScrollView>
          )}

          <WatchTimeCard
            key={child.id}
            child={child}
            avatar={avatarOf(child.id)}
            onPause={async () => {
              const next = !child.paused;
              next ? fx.longPress() : fx.tap();
              done(
                await setPaused(child, next),
                t(next ? 'parent.pausedToast' : 'parent.resumedToast', { name: child.display_name }),
              );
            }}
            onAddTime={async () => {
              fx.tap();
              done(await addTime(child, 15), t('parent.addedTime', { count: 15, name: child.display_name }));
            }}
            onAnswer={async (m) => {
              fx.tap();
              done(
                await answer(child, m),
                m ? t('parent.addedTime', { count: m, name: child.display_name }) : t('parent.toldNotToday', { name: child.display_name }),
              );
            }}
          />

          <Enter index={2} style={styles.section}>
            <SectionHeader title={t('parent.rules')} />
          </Enter>

          <Rules child={child} change={change} />

          <Enter index={6}>
            <WeekChart key={child.id} child={child} />
          </Enter>

          <Enter index={7} style={styles.section}>
            <Latest child={child} onHide={setHiding} />
          </Enter>

          <Pressable
            onPress={() =>
              confirmDestructive(
                t('parent.deleteProfileTitle', { name: child.display_name }),
                t('parent.deleteProfileBody', { name: child.display_name }),
                t('parent.deleteProfileConfirm'),
                t('common.cancel'),
                () => setDeleting(child),
              )
            }
            accessibilityRole="button"
            hitSlop={8}
            style={styles.deleteLink}
          >
            <Text style={styles.deleteText}>{t('parent.deleteProfile', { name: child.display_name })}</Text>
          </Pressable>

          <Enter index={8}>
            <AlertsCard parent={token} onResult={(text, ok) => done(ok, text)} />
          </Enter>

          <Enter index={9}>
            <AccountActions onLock={() => { lock(); goBack(); }} onSignOut={() => { lock(); signOut(); }} onDelete={() => setDeleting('account')} />
          </Enter>
        </ScrollView>
      )}

      <BottomSheet open={!!hiding} onClose={() => setHiding(null)} title={child ? t('parent.hideTitle', { name: child.display_name }) : ''}>
        <View style={{ gap: space.md, paddingHorizontal: space.xl }}>
          <Text style={styles.sheetCaption} numberOfLines={2}>
            “{hiding ? localized(lang, hiding.caption, hiding.caption_i18n) : ''}”
          </Text>
          <Text style={styles.sheetSub}>{t('parent.hideSub')}</Text>
          <PressScale
            onPress={async () => {
              const v = hiding;
              setHiding(null);
              if (child && v) done(await hideVideo(child, v.id), t('parent.hidden'));
            }}
            accessibilityRole="button"
            style={styles.hideButton}
          >
            <Icon name="eyeOff" size={18} color={color.ink} strokeWidth={2.4} />
            <Text style={styles.hideText}>{t('parent.hideButton')}</Text>
          </PressScale>
        </View>
      </BottomSheet>
    </View>
  );
}

/** Today at a glance (after Whatnot): who, live status, a big "30m of 1h" with a slim bar, and the two remote buttons. */
function WatchTimeCard({
  child,
  avatar,
  onPause,
  onAddTime,
  onAnswer,
}: {
  child: Child;
  avatar: string | null;
  onPause: () => void;
  onAddTime: () => void;
  onAnswer: (m: number | null) => void;
}) {
  const { t } = useT();
  const L = lanes[child.lane];
  const today = child.week[child.week.length - 1];
  const used = (today?.video_s ?? 0) + (today?.game_s ?? 0);
  const limit = child.daily_limit_minutes == null ? null : child.daily_limit_minutes + child.extra_minutes;
  const reached = limit != null && used >= limit * 60;
  const p = presence(child, t);

  return (
    <Enter index={1} style={[styles.card, styles.hero]}>
      <View style={styles.heroTop}>
        <Avatar name={child.display_name} avatar={avatar} lane={child.lane} size={52} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.heroNameRow}>
            <Text style={styles.heroName} numberOfLines={1}>
              {child.display_name}
            </Text>
            <View style={[styles.lanePill, { backgroundColor: L.color }]}>
              <Text style={styles.lanePillText}>
                {t(laneKey(child.lane))} · {L.ages}
              </Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            {child.paused ? <Icon name="pause" size={12} color={color.verified} strokeWidth={3} /> : p.live && <LiveDot />}
            <Text style={[styles.status, child.paused ? { color: color.verified } : p.live && { color: GREEN }]} numberOfLines={1}>
              {child.paused ? t('parent.paused') : p.text}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <Text style={styles.overline}>{t('parent.watchTime')}</Text>
        <View style={styles.bigRow}>
          <Text style={[styles.bigValue, reached && { color: RED }]} numberOfLines={1}>
            {minutes(t, used)}
          </Text>
          <Text style={styles.bigOf} numberOfLines={1}>
            {limit ? t('parent.ofLimit', { limit: minutes(t, limit * 60) }) : t('parent.noLimit')}
          </Text>
        </View>
        {limit != null && <Meter progress={used / (limit * 60)} tint={child.paused ? color.verified : reached ? RED : color.ember} />}
        {child.extra_minutes > 0 && <Text style={styles.extra}>{t('parent.extraToday', { count: child.extra_minutes })}</Text>}
      </View>

      {child.request && <RequestCard name={child.display_name} at={child.request.created_at} onAnswer={onAnswer} />}

      <View style={styles.actions}>
        <PressScale onPress={onPause} accessibilityRole="button" style={[styles.action, child.paused ? styles.resume : styles.pause]}>
          <Icon name={child.paused ? 'play' : 'pause'} size={18} color={color.ink} strokeWidth={2.8} />
          <Text style={styles.actionTextInk} numberOfLines={1} adjustsFontSizeToFit>
            {child.paused ? t('parent.resume') : t('parent.pauseNow')}
          </Text>
        </PressScale>
        <PressScale onPress={onAddTime} disabled={limit == null} accessibilityRole="button" style={[styles.action, styles.addTime, limit == null && { opacity: 0.4 }]}>
          <Icon name="plus" size={18} color={color.text} strokeWidth={2.6} />
          <Text style={styles.actionText}>{t('common.minutes', { count: 15 })}</Text>
        </PressScale>
      </View>
    </Enter>
  );
}

/** A slim track whose fill springs out from the left (transform only). */
function Meter({ progress, tint }: { progress: number; tint: string }) {
  const reduce = useReducedMotion();
  const target = Math.min(1, Math.max(0, progress));
  const s = useSharedValue(reduce ? target : 0);
  useEffect(() => {
    s.value = reduce ? target : withDelay(220, withSpring(target, spring.smooth));
  }, [target, reduce, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.015, s.value) }] }));
  return (
    <View style={styles.meterTrack}>
      <Animated.View style={[styles.meterFill, { backgroundColor: tint, transformOrigin: 'left' }, anim]} />
    </View>
  );
}

/** "Hugo is asking for more time": answer right here. */
function RequestCard({ name, at, onAnswer }: { name: string; at: string; onAnswer: (m: number | null) => void }) {
  const { t } = useT();
  const mins = Math.max(1, Math.round((Date.now() - new Date(at).getTime()) / 60_000));
  return (
    <Enter index={0} rise={8} style={styles.request}>
      <View style={styles.requestHead}>
        <IconCircle icon="clock" tint={YELLOW} size={32} />
        <Text style={styles.requestTitle}>
          {t('parent.asking', { name })} <Text style={styles.requestAgo}>· {ago(t, mins)}</Text>
        </Text>
      </View>
      <View style={styles.requestActions}>
        {[15, 30].map((m) => (
          <PressScale key={m} onPress={() => onAnswer(m)} accessibilityRole="button" style={[styles.requestButton, styles.requestYes]}>
            <Text style={styles.requestYesText}>+{t('common.minutes', { count: m })}</Text>
          </PressScale>
        ))}
        <PressScale onPress={() => onAnswer(null)} accessibilityRole="button" style={styles.requestButton}>
          <Text style={styles.requestNoText} numberOfLines={1} adjustsFontSizeToFit>
            {t('parent.notToday')}
          </Text>
        </PressScale>
      </View>
    </Enter>
  );
}

type Status = { label: string; tint: string };

/** Each control as its own card (after Jomo): icon + title, a status chip, the value on the right, the control below. */
function Rules({ child, change }: { child: Child; change: (c: Child, next: Partial<Controls>, text: string) => void }) {
  const { t, lang } = useT();
  const today = child.week[child.week.length - 1];
  const used = (today?.video_s ?? 0) + (today?.game_s ?? 0);
  const limit = child.daily_limit_minutes == null ? null : child.daily_limit_minutes + child.extra_minutes;
  const left = limit == null ? 0 : Math.max(0, limit * 60 - used);
  const off: Status = { label: t('common.off'), tint: color.text3 };

  const limitStatus: Status = limit == null ? off : left === 0 ? { label: t('parent.statusReached'), tint: RED } : { label: t('common.on'), tint: GREEN };
  const quietNow = inQuietHours(new Date().getHours(), child.bedtime_hour, child.wake_hour);
  const quietStatus: Status = !child.quiet_hours ? off : quietNow ? { label: t('parent.statusNow'), tint: color.verified } : { label: t('parent.statusUpcoming'), tint: GREEN };
  const gamesStatus: Status = child.games_enabled ? { label: t('common.on'), tint: GREEN } : off;

  return (
    <>
      <Enter index={3}>
        <RuleCard
          icon="clock"
          tint={color.ember}
          title={t('parent.dailyLimit')}
          status={limitStatus}
          meta={limit == null ? t('parent.noLimit') : t('parent.timeLeft', { time: minutes(t, left) })}
          value={child.daily_limit_minutes == null ? t('common.off') : t('common.minutes', { count: child.daily_limit_minutes })}
        >
          <Segmented
            options={LIMITS}
            value={child.daily_limit_minutes}
            label={(l) => (l == null ? t('common.off') : String(l))}
            onChange={(l) => change(child, { daily_limit_minutes: l }, l == null ? t('parent.limitOff') : t('parent.limitSet', { count: l }))}
          />
        </RuleCard>
      </Enter>

      <Enter index={4}>
        <RuleCard
          icon="moon"
          tint={color.verified}
          title={t('parent.quietHours')}
          status={quietStatus}
          meta={t('parent.quietSub', { from: hourLabel(child.bedtime_hour, lang), to: hourLabel(child.wake_hour, lang) })}
          toggle={{
            on: child.quiet_hours,
            onPress: () => change(child, { quiet_hours: !child.quiet_hours }, child.quiet_hours ? t('parent.quietOff') : t('parent.quietOn')),
          }}
        >
          {child.quiet_hours && (
            <View style={styles.hours}>
              <HourStepper
                label={t('parent.bedtime')}
                value={child.bedtime_hour}
                onChange={(h) => change(child, { bedtime_hour: h }, t('parent.bedtimeSet', { time: hourLabel(h, lang) }))}
              />
              <HourStepper
                label={t('parent.wakeUp')}
                value={child.wake_hour}
                onChange={(h) => change(child, { wake_hour: h }, t('parent.wakeSet', { time: hourLabel(h, lang) }))}
              />
            </View>
          )}
        </RuleCard>
      </Enter>

      <Enter index={5}>
        <RuleCard
          icon="game"
          tint={YELLOW}
          title={t('parent.games')}
          status={gamesStatus}
          meta={t('parent.gamesSub')}
          toggle={{
            on: child.games_enabled,
            onPress: () => change(child, { games_enabled: !child.games_enabled }, child.games_enabled ? t('parent.gamesOff') : t('parent.gamesOn')),
          }}
        />
      </Enter>
    </>
  );
}

function RuleCard({
  icon,
  tint,
  title,
  status,
  meta,
  value,
  toggle,
  children,
}: {
  icon: IconName;
  tint: string;
  title: string;
  status: Status;
  meta: string;
  value?: string;
  toggle?: { on: boolean; onPress: () => void };
  children?: ReactNode;
}) {
  const head = (
    <>
      <IconCircle icon={icon} tint={tint} size={36} />
      <Text style={styles.ruleTitle} numberOfLines={1}>
        {title}
      </Text>
      {!!value && <Text style={styles.ruleValue}>{value}</Text>}
      {toggle && <Toggle on={toggle.on} tint={GREEN} />}
    </>
  );
  return (
    <View style={styles.ruleCard}>
      {toggle ? (
        <Pressable
          onPress={() => {
            fx.toggle(!toggle.on);
            toggle.onPress();
          }}
          style={styles.ruleHead}
          accessibilityRole="switch"
          accessibilityLabel={title}
          accessibilityState={{ checked: toggle.on }}
        >
          {head}
        </Pressable>
      ) : (
        <View style={styles.ruleHead}>{head}</View>
      )}
      <View style={styles.ruleMeta}>
        <StatusChip status={status} />
        <View style={styles.metaDivider} />
        <Text style={styles.metaText} numberOfLines={2}>
          {meta}
        </Text>
      </View>
      {children}
    </View>
  );
}

function StatusChip({ status }: { status: Status }) {
  return (
    <View style={[styles.statusChip, { borderColor: status.tint + '66', backgroundColor: status.tint + '1A' }]}>
      <View style={[styles.statusDot, { backgroundColor: status.tint }]} />
      <Text style={[styles.statusChipText, { color: status.tint }]}>{status.label}</Text>
    </View>
  );
}

/** Opt this phone in to parent alerts. Pushes go only to phones switched on here. */
function AlertsCard({ parent, onResult }: { parent: string | null; onResult: (text: string, ok: boolean) => void }) {
  const { t } = useT();
  const [on, setOn] = useState(() => !!storedPushToken());
  const [busy, setBusy] = useState(false);

  const flip = async () => {
    if (busy) return;
    fx.toggle(!on);
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

  return (
    <View style={styles.ruleCard}>
      <Pressable onPress={flip} style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: on, busy }}>
        <IconCircle icon="inbox" tint={GREEN} size={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.label}>{t('parent.alertsLabel')}</Text>
          <Text style={styles.sub}>{t('parent.alertsSub')}</Text>
        </View>
        <Toggle on={on} tint={GREEN} />
      </Pressable>
    </View>
  );
}

/** Seven stacked bars (videos + games), rising one after another, under a big weekly total. */
function WeekChart({ child }: { child: Child }) {
  const { t } = useT();
  const dayLetter = t('parent.dayLetters').split(',');
  const total = child.week.reduce((n, d) => n + d.video_s + d.game_s, 0);
  const max = Math.max(1, ...child.week.map((d) => d.video_s + d.game_s), (child.daily_limit_minutes ?? 0) * 60);
  const limitY = child.daily_limit_minutes ? (child.daily_limit_minutes * 60) / max : null;

  return (
    <View style={styles.card}>
      <View style={{ gap: 4 }}>
        <Text style={styles.overline}>{t('parent.thisWeek')}</Text>
        <View style={styles.bigRow}>
          <Text style={styles.weekValue}>{minutes(t, total)}</Text>
          <Text style={styles.bigOf}>{t('parent.perDay', { avg: minutes(t, total / 7) })}</Text>
        </View>
      </View>
      <View style={styles.chart}>
        {limitY != null && <View style={[styles.limitLine, { bottom: 22 + limitY * CHART_H }]} />}
        {child.week.map((d, i) => {
          const isToday = i === child.week.length - 1;
          return (
            <View key={d.day} style={styles.barCol}>
              <Bar index={i} video={d.video_s / max} game={d.game_s / max} today={isToday} />
              <Text style={[styles.dayLetter, isToday && { color: color.text }]}>{dayLetter[new Date(d.day + 'T12:00:00').getDay()]}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={[styles.swatch, { backgroundColor: GREEN }]} />
        <Text style={styles.legendText}>{t('parent.videos')}</Text>
        <View style={[styles.swatch, { backgroundColor: YELLOW }]} />
        <Text style={styles.legendText}>{t('parent.games')}</Text>
      </View>
    </View>
  );
}

const CHART_H = 110;

function Bar({ index, video, game, today }: { index: number; video: number; game: number; today: boolean }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) s.value = withDelay(240 + index * 45, withSpring(1, spring.smooth));
  }, [index, reduce, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scaleY: s.value }] }));
  const h = Math.max(video + game > 0 ? 4 : 2, (video + game) * CHART_H);

  return (
    <View style={{ height: CHART_H, justifyContent: 'flex-end' }}>
      <Animated.View style={[styles.bar, { height: h, opacity: today ? 1 : 0.55, transformOrigin: 'bottom' }, anim]}>
        {video + game === 0 ? (
          <View style={{ flex: 1, backgroundColor: color.line }} />
        ) : (
          <>
            <View style={{ flex: game, backgroundColor: YELLOW }} />
            <View style={{ flex: video, backgroundColor: GREEN }} />
          </>
        )}
      </Animated.View>
    </View>
  );
}

type LatestItem =
  | { kind: 'flag'; key: string; at: number; what: string; reason: string }
  | { kind: 'video'; key: string; at: number; what: string; row: RecentRow; seconds: number }
  | { kind: 'topic'; key: string; what: string; seconds: number };

/**
 * What's been happening (after Finch): flags and recent videos newest first,
 * then this week's top topics. Tap a video row to hide it from the child.
 */
function Latest({ child, onHide }: { child: Child; onHide: (v: RecentRow) => void }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const signed = useRef('');
  useEffect(() => {
    const key = child.recent.map((r) => r.id).join();
    if (key === signed.current) return;
    signed.current = key;
    signMedia(child.recent).then(setUrls);
  }, [child.recent]);

  const now = Date.now();
  const events: LatestItem[] = [
    ...child.flags.map((f) => ({
      kind: 'flag' as const,
      key: 'f' + f.video_id + f.at,
      at: new Date(f.at).getTime(),
      what: localized(lang, f.caption, f.caption_i18n),
      reason: reasonLabel(t, f.reason),
    })),
    ...child.recent.map((r) => ({
      kind: 'video' as const,
      key: 'v' + r.id,
      at: new Date(r.last_at).getTime(),
      what: localized(lang, r.caption, r.caption_i18n),
      row: r,
      seconds: r.seconds,
    })),
  ].sort((a, b) => b.at - a.at);
  const items: LatestItem[] = [
    ...events,
    ...child.topics.slice(0, 3).map((x) => ({ kind: 'topic' as const, key: 't' + x.slug, what: `${x.emoji} ${topicLabel(t, x.slug, x.label)}`, seconds: x.seconds })),
  ];
  const shown = open ? items : items.slice(0, LATEST_FOLD);
  const name = child.display_name;
  const hasVideos = child.recent.some((r) => !r.hidden);

  return (
    <View style={{ gap: space.md }}>
      <SectionHeader
        title={t('parent.latest')}
        action={items.length > LATEST_FOLD ? t(open ? 'parent.showLess' : 'parent.seeAll') : undefined}
        onAction={() => {
          fx.tap();
          setOpen((o) => !o);
        }}
      />
      {items.length === 0 ? (
        <View style={styles.ruleCard}>
          <Text style={styles.muted}>{t('parent.nothingWatched')}</Text>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          {shown.map((it, i) => {
            if (it.kind === 'flag') {
              return (
                <Enter key={it.key} index={i} rise={8}>
                  <View style={[styles.latestRow, styles.latestFlag]}>
                    <IconCircle icon="flag" tint={RED} size={40} />
                    <View style={styles.latestBody}>
                      <Rich text={t('parent.latestFlagged')} values={{ name, what: it.what }} bold={['name', 'what']} style={styles.latestText} lines={2} />
                      <Text style={styles.latestSub} numberOfLines={2}>
                        {t('parent.latestFlaggedSub', { reason: it.reason })} · {ago(t, Math.round((now - it.at) / 60_000))}
                      </Text>
                    </View>
                  </View>
                </Enter>
              );
            }
            if (it.kind === 'topic') {
              return (
                <Enter key={it.key} index={i} rise={8}>
                  <View style={styles.latestRow}>
                    <IconCircle icon="sparkle" tint={GREEN} size={40} />
                    <View style={styles.latestBody}>
                      <Rich text={t('parent.latestWatched')} values={{ name, what: it.what, time: minutes(t, it.seconds) }} bold={['name', 'what']} style={styles.latestText} lines={2} />
                      <Text style={styles.latestSub}>{t('parent.thisWeek')}</Text>
                    </View>
                  </View>
                </Enter>
              );
            }
            const r = it.row;
            const m = mediaFor(r, urls);
            return (
              <Enter key={it.key} index={i} rise={8}>
                <PressScale
                  disabled={r.hidden}
                  pressedScale={0.98}
                  onPress={() => {
                    fx.tap();
                    onHide(r);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={r.hidden ? t('parent.hiddenA11y', { caption: it.what }) : it.what}
                  style={styles.latestRow}
                >
                  <IconCircle icon={r.hidden ? 'eyeOff' : 'play'} tint={r.hidden ? color.text3 : lanes[r.lane].color} size={40} />
                  <View style={styles.latestBody}>
                    <Rich text={t('parent.latestWatched')} values={{ name, what: `“${it.what}”`, time: minutes(t, it.seconds) }} bold={['name', 'what']} style={styles.latestText} lines={2} />
                    <Text style={styles.latestSub}>
                      {r.hidden ? `${t('parent.hidden')} · ` : ''}
                      {ago(t, Math.round((now - it.at) / 60_000))}
                    </Text>
                  </View>
                  {m ? <Image source={m.thumb} cachePolicy="memory-disk" style={[styles.latestThumb, r.hidden && { opacity: 0.3 }]} /> : <View style={styles.latestThumb} />}
                </PressScale>
              </Enter>
            );
          })}
          {hasVideos && <Text style={[styles.muted, { textAlign: 'center' }]}>{t('parent.tapToHide', { name })}</Text>}
        </View>
      )}
    </View>
  );
}

/** A translated sentence with some {placeholders} set in bold. */
function Rich({ text, values, bold, style, lines }: { text: string; values: Record<string, string>; bold: string[]; style: TextStyle; lines?: number }) {
  const parts = text.split(/(\{\w+\})/g);
  return (
    <Text style={style} numberOfLines={lines}>
      {parts.map((p, i) => {
        const k = /^\{(\w+)\}$/.exec(p)?.[1];
        if (!k || values[k] == null) return p;
        return bold.includes(k) ? (
          <Text key={i} style={styles.bold}>
            {values[k]}
          </Text>
        ) : (
          values[k]
        );
      })}
    </Text>
  );
}

/** − 8pm + ; saves 600ms after the last tap so quick taps don't each notify the child. */
function HourStepper({ label, value, onChange }: { label: string; value: number; onChange: (h: number) => void }) {
  const { t, lang } = useT();
  const [h, setH] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setH(value), [value]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const step = (d: number) => {
    fx.key();
    const next = (h + d + 24) % 24;
    setH(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), 600);
  };

  return (
    <View style={styles.stepper}>
      <Text style={styles.sub}>{label}</Text>
      <View style={styles.stepRow}>
        <PressScale onPress={() => step(-1)} pressedScale={0.85} hitSlop={7} accessibilityRole="button" accessibilityLabel={t('parent.earlier', { label })} style={styles.stepButton}>
          <Icon name="minus" size={16} strokeWidth={2.6} />
        </PressScale>
        <Text style={styles.stepValue}>{hourLabel(h, lang)}</Text>
        <PressScale onPress={() => step(1)} pressedScale={0.85} hitSlop={7} accessibilityRole="button" accessibilityLabel={t('parent.later', { label })} style={styles.stepButton}>
          <Icon name="plus" size={16} strokeWidth={2.6} />
        </PressScale>
      </View>
    </View>
  );
}

/** A soft green pulse: someone is on Payhas right now. */
function LiveDot() {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduce, t]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - t.value), transform: [{ scale: 1 + 1.4 * t.value }] }));
  return (
    <View style={styles.liveDot}>
      <Animated.View style={[styles.liveHalo, halo]} />
      <View style={styles.liveCore} />
    </View>
  );
}

/** Destructive choices confirm first; react-native-web's Alert shows nothing, so the browser build confirms natively. */
function confirmDestructive(title: string, body: string, action: string, cancel: string, onYes: () => void) {
  fx.tap();
  if (Platform.OS === 'web') return window.confirm(`${title}\n\n${body}`) && onYes();
  Alert.alert(title, body, [
    { text: cancel, style: 'cancel' },
    { text: action, style: 'destructive', onPress: onYes },
  ]);
}

/** Leaving the dashboard: lock it, sign the whole family out (to switch accounts), or delete the account. */
function AccountActions({ onLock, onSignOut, onDelete }: { onLock: () => void; onSignOut: () => void; onDelete: () => void }) {
  const { t } = useT();
  const confirm = (title: string, body: string, action: string, onYes: () => void) => confirmDestructive(title, body, action, t('common.cancel'), onYes);
  return (
    <View>
      <View style={styles.accountRow}>
        <PressScale onPress={() => { fx.tap(); onLock(); }} accessibilityRole="button" style={[styles.lockButton, styles.accountButton]}>
          <Icon name="lock" size={16} color={color.text2} strokeWidth={2.2} />
          <Text style={styles.lockText} numberOfLines={1} adjustsFontSizeToFit>
            {t('parent.lock')}
          </Text>
        </PressScale>
        <PressScale
          onPress={() => confirm(t('parent.signOutTitle'), t('parent.signOutBody'), t('parent.signOut'), onSignOut)}
          accessibilityRole="button"
          style={[styles.lockButton, styles.accountButton]}
        >
          <Icon name="close" size={16} color={RED} strokeWidth={2.2} />
          <Text style={[styles.lockText, { color: RED }]} numberOfLines={1} adjustsFontSizeToFit>
            {t('parent.signOut')}
          </Text>
        </PressScale>
      </View>
      <Pressable
        onPress={() => confirm(t('parent.deleteTitle'), t('parent.deleteBody'), t('parent.deleteConfirm'), onDelete)}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.deleteLink}
      >
        <Text style={styles.deleteText}>{t('parent.deleteAccount')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  accountRow: { flexDirection: 'row', gap: space.sm },
  accountButton: { flex: 1, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surface1 },
  root: { flex: 1, backgroundColor: color.ink },
  pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingBottom: 80 },
  pinHint: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  content: { paddingHorizontal: space.lg, gap: space.md },
  section: { marginTop: space.md },
  empty: { alignItems: 'center', gap: space.sm, paddingTop: 120, paddingHorizontal: space.xl },
  emptyTitle: { color: color.text, fontFamily: font.title, fontSize: 20, textAlign: 'center' },
  emptySub: { color: color.text2, fontFamily: font.medium, fontSize: 14, textAlign: 'center' },

  picker: { gap: space.sm, paddingBottom: space.xs },
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 46, paddingLeft: 6, paddingRight: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.line, backgroundColor: color.surface1 },
  pickName: { color: color.text2, fontFamily: font.semibold, fontSize: 14 },

  card: { backgroundColor: color.surface1, borderRadius: 24, padding: space.lg, gap: space.md },
  hero: { gap: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroName: { flexShrink: 1, color: color.text, fontFamily: font.display, fontSize: 24, letterSpacing: -0.5 },
  lanePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  lanePillText: { color: color.ink, fontFamily: font.bold, fontSize: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { color: color.text3, fontFamily: font.semibold, fontSize: 13 },
  overline: { color: color.text3, fontFamily: font.semibold, fontSize: 13 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  bigValue: { color: color.text, fontFamily: font.mono, fontSize: 40, letterSpacing: -1 },
  bigOf: { flexShrink: 1, color: color.text3, fontFamily: font.mono, fontSize: 15 },
  weekValue: { color: color.text, fontFamily: font.mono, fontSize: 28, letterSpacing: -0.6 },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: color.surface2, overflow: 'hidden' },
  meterFill: { height: 8, width: '100%', borderRadius: 4 },
  extra: { color: YELLOW, fontFamily: font.semibold, fontSize: 12 },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 52, borderRadius: radius.pill },
  pause: { flex: 1.4, backgroundColor: color.ember },
  resume: { flex: 1.4, backgroundColor: GREEN },
  addTime: { flex: 1, backgroundColor: color.surface2 },
  actionTextInk: { color: color.ink, fontFamily: font.bold, fontSize: 16 },
  actionText: { color: color.text, fontFamily: font.bold, fontSize: 16 },

  ruleCard: { backgroundColor: color.surface1, borderRadius: 24, padding: space.lg, gap: space.md },
  ruleHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  ruleTitle: { flex: 1, color: color.text, fontFamily: font.title, fontSize: 18 },
  ruleValue: { color: color.text, fontFamily: font.mono, fontSize: 18 },
  ruleMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  metaDivider: { width: 1.5, height: 14, borderRadius: 1, backgroundColor: color.line },
  metaText: { flex: 1, color: color.text3, fontFamily: font.medium, fontSize: 13 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontFamily: font.bold, fontSize: 12 },

  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: space.sm },
  limitLine: { position: 'absolute', left: 0, right: 0, height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: RED, opacity: 0.6 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  bar: { width: 22, borderRadius: 8, overflow: 'hidden' },
  dayLetter: { color: color.text3, fontFamily: font.mono, fontSize: 12, height: 16 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  legendText: { color: color.text3, fontFamily: font.medium, fontSize: 12 },

  label: { color: color.text, fontFamily: font.semibold, fontSize: 15 },
  sub: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  muted: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 2 },
  hours: { flexDirection: 'row', gap: space.sm },
  stepper: { flex: 1, padding: space.md, borderRadius: 16, backgroundColor: color.ink, gap: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: color.text, fontFamily: font.mono, fontSize: 17 },

  latestRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 20, backgroundColor: color.surface1 },
  latestFlag: { backgroundColor: alpha(color.danger, 0.1) },
  latestBody: { flex: 1, gap: 3 },
  latestText: { color: color.text2, fontFamily: font.medium, fontSize: 15, lineHeight: 20 },
  bold: { color: color.text, fontFamily: font.bold },
  latestSub: { color: color.text3, fontFamily: font.medium, fontSize: 12 },
  latestThumb: { width: 40, height: 54, borderRadius: 8, backgroundColor: color.surface2 },

  lockButton: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.lg, marginTop: space.sm },
  lockText: { color: color.text2, fontFamily: font.semibold, fontSize: 14 },
  deleteLink: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', paddingHorizontal: space.lg, marginTop: space.xs },
  deleteText: { color: color.text3, fontFamily: font.semibold, fontSize: 13, textDecorationLine: 'underline' },

  sheetCaption: { color: color.text, fontFamily: font.bold, fontSize: 16 },
  sheetSub: { color: color.text2, fontFamily: font.medium, fontSize: 14 },
  hideButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 52, borderRadius: radius.pill, backgroundColor: color.ember, marginTop: space.sm },
  hideText: { color: color.ink, fontFamily: font.bold, fontSize: 16 },

  request: { padding: space.md, borderRadius: 18, backgroundColor: alpha(color.reward, 0.1), borderWidth: 1, borderColor: alpha(color.reward, 0.35), gap: space.md },
  requestHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  requestTitle: { flex: 1, color: color.text, fontFamily: font.semibold, fontSize: 14 },
  requestAgo: { color: color.text3, fontFamily: font.medium },
  requestActions: { flexDirection: 'row', gap: space.sm },
  requestButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  requestYes: { backgroundColor: YELLOW },
  requestYesText: { color: color.ink, fontFamily: font.bold, fontSize: 14 },
  requestNoText: { color: color.text, fontFamily: font.semibold, fontSize: 14 },
  liveDot: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveHalo: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },
  liveCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
});
