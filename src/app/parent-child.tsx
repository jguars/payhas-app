import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { PinPad } from '@/components/PinPad';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import { Avatar } from '@/components/ui/Avatar';
import { useFamily } from '@/features/family/FamilyProvider';
import { ChildPhone } from '@/features/parent/ChildPhone';
import { useLinkedPhones } from '@/features/parent/devices';
import { hourLabel, inQuietHours } from '@/features/library/useScreenTime';
import {
  confirmDestructive,
  Group,
  HourStepper,
  Latest,
  LiveDot,
  LockedHistory,
  RequestCard,
  Row,
  RowIcon,
  TodayCard,
  WeekChart,
} from '@/features/parent/parts';
import { Controls, minutes, presence, RecentRow, useParent } from '@/features/parent/useParent';
import { laneKey, localized, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useGoBack } from '@/lib/useGoBack';
import { useInsets } from '@/lib/useInsets';
import { color, font, lane as lanes, pageFill, radius, size, space, themedStyles } from '@/theme/tokens';

const LIMITS: (number | null)[] = [null, 15, 30, 45, 60, 90, 120];

/**
 * One child's page in the parent dashboard, after Spotify Kids' and Garmin's
 * child accounts and Instagram's Time management: who and what they're doing,
 * today against the limit with the remote buttons, the rules as rows that open
 * a sheet, then the week and what they watched (Plus).
 */
export default function ChildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, unlocked, children, plus, unlock, reload, setControls, setPaused, addTime, answer, hideVideo } = useParent();
  const linked = useLinkedPhones(token);
  const { profiles, refresh } = useFamily();
  const { bottom } = useInsets();
  const toast = useToast();
  const goBack = useGoBack();
  const { t, lang } = useT();
  const [sheet, setSheet] = useState<'limit' | 'quiet' | null>(null);
  const [hiding, setHiding] = useState<RecentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        <ScreenHeader title={t('parent.title')} />
        <View style={styles.pinWrap}>
          <PinPad title={t('common.parentPin')} onComplete={unlock} onCancel={() => goBack()} />
        </View>
      </View>
    );
  }

  const child = children?.find((c) => c.id === id);
  if (!child) return <View style={styles.root}><ScreenHeader title="" /></View>;

  // Deleting asks for the PIN again, even inside an open parent session.
  if (deleting) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('parent.deleteProfile', { name: child.display_name })} />
        <View style={styles.pinWrap}>
          <PinPad
            title={t('parent.deletePinTitle')}
            onCancel={() => setDeleting(false)}
            onComplete={async (pin) => {
              const { data, error } = await supabase.rpc('delete_profile', { p_pin: pin, p_profile_id: child.id });
              if (error) return error.message;
              if (!data) return false;
              toast({ text: t('parent.profileDeletedToast', { name: child.display_name }), icon: 'check' });
              await Promise.all([reload(), refresh()]);
              router.back();
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

  const change = async (next: Partial<Controls>, text: string) => {
    done(
      await setControls(child, {
        daily_limit_minutes: child.daily_limit_minutes,
        quiet_hours: child.quiet_hours,
        bedtime_hour: child.bedtime_hour,
        wake_hour: child.wake_hour,
        games_enabled: child.games_enabled,
        ...next,
      }),
      text,
    );
  };

  const L = lanes[child.lane];
  const p = presence(child, t);
  const avatar = profiles.find((x) => x.id === child.id)?.avatar ?? null;
  const today = child.week[child.week.length - 1];
  const used = (today?.video_s ?? 0) + (today?.game_s ?? 0);
  const limit = child.daily_limit_minutes == null ? null : child.daily_limit_minutes + child.extra_minutes;
  const left = limit == null ? 0 : Math.max(0, limit * 60 - used);
  const quietNow = child.quiet_hours && inQuietHours(new Date().getHours(), child.bedtime_hour, child.wake_hour);
  const range = t('parent.quietRange', { from: hourLabel(child.bedtime_hour, lang), to: hourLabel(child.wake_hour, lang) });

  return (
    <View style={styles.root}>
      <ScreenHeader title="" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + space.xxl }]} showsVerticalScrollIndicator={false}>
        <Enter index={0} style={styles.hero}>
          <Avatar name={child.display_name} avatar={avatar} lane={child.lane} size={96} />
          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
            {child.display_name}
          </Text>
          <View style={styles.heroMeta}>
            <View style={[styles.lanePill, { backgroundColor: L.color }]}>
              <Text style={styles.lanePillText}>
                {t(laneKey(child.lane))} · {L.ages}
              </Text>
            </View>
            <PressScale onPress={() => router.push({ pathname: '/profile-edit', params: { id: child.id } })} accessibilityRole="button" style={styles.editPill}>
              <Icon name="me" size={14} color={color.text} strokeWidth={2.4} />
              <Text style={styles.editText}>{t('parent.editProfile')}</Text>
            </PressScale>
            <View style={styles.statusRow}>
              {child.paused ? <Icon name="pause" size={12} color={color.verified} strokeWidth={3} /> : p.live && <LiveDot />}
              <Text style={[styles.status, child.paused ? { color: color.verified } : p.live && { color: color.success }]} numberOfLines={1}>
                {child.paused ? t('parent.paused') : p.text}
              </Text>
            </View>
          </View>
        </Enter>

        {child.request && (
          <RequestCard
            name={child.display_name}
            at={child.request.created_at}
            onAnswer={async (m) => {
              fx.tap();
              done(await answer(child, m), m ? t('parent.addedTime', { count: m, name: child.display_name }) : t('parent.toldNotToday', { name: child.display_name }));
            }}
          />
        )}

        <Enter index={1}>
          <TodayCard
            child={child}
            onPause={async () => {
              const next = !child.paused;
              if (next) fx.longPress();
              else fx.tap();
              done(await setPaused(child, next), t(next ? 'parent.pausedToast' : 'parent.resumedToast', { name: child.display_name }));
            }}
            onAddTime={async () => {
              fx.tap();
              done(await addTime(child, 15), t('parent.addedTime', { count: 15, name: child.display_name }));
            }}
          />
        </Enter>

        <Enter index={2}>
          <Group title={t('parent.rules')}>
            <Row
              first
              leading={<RowIcon icon="clock" tint={color.ember} />}
              label={t('parent.dailyLimit')}
              sub={limit == null ? t('parent.noLimit') : left === 0 ? t('parent.statusReached') : t('parent.timeLeft', { time: minutes(t, left) })}
              value={child.daily_limit_minutes == null ? t('common.off') : t('common.minutes', { count: child.daily_limit_minutes })}
              onPress={() => setSheet('limit')}
            />
            <Row
              leading={<RowIcon icon="moon" tint={color.verified} />}
              label={t('parent.quietHours')}
              sub={child.quiet_hours ? (quietNow ? `${range} · ${t('parent.statusNow')}` : range) : t('parent.quietSub', { from: hourLabel(child.bedtime_hour, lang), to: hourLabel(child.wake_hour, lang) })}
              value={child.quiet_hours ? t('common.on') : t('common.off')}
              onPress={() => setSheet('quiet')}
            />
            <Row
              leading={<RowIcon icon="game" tint={color.warning} />}
              label={t('parent.games')}
              sub={t('parent.gamesSub')}
              toggle={child.games_enabled}
              onPress={() => change({ games_enabled: !child.games_enabled }, child.games_enabled ? t('parent.gamesOff') : t('parent.gamesOn'))}
            />
          </Group>
        </Enter>

        <Enter index={3}>
          <ChildPhone child={child} phones={linked.phones} onRemove={linked.remove} />
        </Enter>

        {plus === false ? (
          <Enter index={4}>
            <LockedHistory />
          </Enter>
        ) : (
          <>
            <Enter index={4}>
              <WeekChart child={child} />
            </Enter>
            <Enter index={5}>
              <Latest child={child} onHide={setHiding} />
            </Enter>
          </>
        )}

        <Pressable
          onPress={() =>
            confirmDestructive(
              t('parent.deleteProfileTitle', { name: child.display_name }),
              t('parent.deleteProfileBody', { name: child.display_name }),
              t('parent.deleteProfileConfirm'),
              t('common.cancel'),
              () => setDeleting(true),
            )
          }
          accessibilityRole="button"
          hitSlop={8}
          style={styles.deleteLink}
        >
          <Text style={styles.deleteText}>{t('parent.deleteProfile', { name: child.display_name })}</Text>
        </Pressable>
      </ScrollView>

      <BottomSheet open={sheet === 'limit'} onClose={() => setSheet(null)} title={t('parent.dailyLimit')}>
        <View style={styles.sheet}>
          <Segmented
            options={LIMITS}
            value={child.daily_limit_minutes}
            label={(l) => (l == null ? t('common.off') : String(l))}
            onChange={(l) => change({ daily_limit_minutes: l }, l == null ? t('parent.limitOff') : t('parent.limitSet', { count: l }))}
          />
          <Text style={styles.sheetSub}>{limit == null ? t('parent.noLimit') : t('parent.timeLeft', { time: minutes(t, left) })}</Text>
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === 'quiet'} onClose={() => setSheet(null)} title={t('parent.quietHours')}>
        <View style={styles.sheet}>
          <Row
            first
            label={t('parent.quietHours')}
            sub={t('parent.quietSub', { from: hourLabel(child.bedtime_hour, lang), to: hourLabel(child.wake_hour, lang) })}
            toggle={child.quiet_hours}
            onPress={() => change({ quiet_hours: !child.quiet_hours }, child.quiet_hours ? t('parent.quietOff') : t('parent.quietOn'))}
          />
          {child.quiet_hours && (
            <View style={styles.hours}>
              <HourStepper label={t('parent.bedtime')} value={child.bedtime_hour} onChange={(h) => change({ bedtime_hour: h }, t('parent.bedtimeSet', { time: hourLabel(h, lang) }))} />
              <HourStepper label={t('parent.wakeUp')} value={child.wake_hour} onChange={(h) => change({ wake_hour: h }, t('parent.wakeSet', { time: hourLabel(h, lang) }))} />
            </View>
          )}
        </View>
      </BottomSheet>

      <BottomSheet open={!!hiding} onClose={() => setHiding(null)} title={t('parent.hideTitle', { name: child.display_name })}>
        <View style={styles.sheet}>
          <Text style={styles.sheetCaption} numberOfLines={2}>
            “{hiding ? localized(lang, hiding.caption, hiding.caption_i18n) : ''}”
          </Text>
          <Text style={styles.sheetSub}>{t('parent.hideSub')}</Text>
          <PressScale
            onPress={async () => {
              const v = hiding;
              setHiding(null);
              if (v) done(await hideVideo(child, v.id), t('parent.hidden'));
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

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingBottom: 80 },
  content: { paddingHorizontal: space.lg, gap: space.xl },
  hero: { alignItems: 'center', gap: space.sm },
  name: { color: color.text, fontFamily: font.display, fontSize: size.headline, letterSpacing: -0.7, marginTop: space.xs },
  heroMeta: { alignItems: 'center', gap: space.sm },
  lanePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  lanePillText: { color: color.ink, fontFamily: font.bold, fontSize: size.caption },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editPill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line },
  editText: { color: color.text, fontFamily: font.semibold, fontSize: size.small },
  status: { color: color.text3, fontFamily: font.semibold, fontSize: size.small },
  sheet: { gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.md },
  sheetCaption: { color: color.text, fontFamily: font.bold, fontSize: size.body },
  sheetSub: { color: color.text2, fontFamily: font.medium, fontSize: size.small },
  hours: { flexDirection: 'row', gap: space.sm },
  hideButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 52, borderRadius: radius.pill, backgroundColor: color.ember, marginTop: space.sm },
  hideText: { color: color.ink, fontFamily: font.bold, fontSize: size.body },
  deleteLink: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', paddingHorizontal: space.lg },
  deleteText: { color: color.text3, fontFamily: font.semibold, fontSize: size.small, textDecorationLine: 'underline' },
}));
