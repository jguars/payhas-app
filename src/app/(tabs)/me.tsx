import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon, IconName } from '@/components/Icon';
import { LanguagePicker } from '@/components/LanguagePicker';
import { CountUp } from '@/components/motion/CountUp';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { Ring } from '@/components/motion/Ring';
import { Toggle } from '@/components/motion/Toggle';
import { StatusScrim } from '@/components/StatusScrim';
import { useRoles } from '@/features/creator/useRoles';
import { REVIEW_ENABLED } from '@/features/creator/useReviewQueue';
import { useFamily } from '@/features/family/FamilyProvider';
import { useLibrary } from '@/features/library/LibraryProvider';
import { useScreenTime } from '@/features/library/useScreenTime';
import { TasteCard } from '@/features/me/TasteCard';
import { useMe } from '@/features/me/useMe';
import { laneKey, LANGS, useT } from '@/i18n';
import { fx, getFeedbackSettings, setFeedbackSettings } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { color, font, lane as lanes, space } from '@/theme/tokens';

const GREEN = '#4FE3B0';

export default function MeScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const { current, leaveProfile, signOut } = useFamily();
  const { todaySeconds } = useLibrary();
  const { limitMinutes } = useScreenTime();
  const { data, reload, resetTaste } = useMe();
  const roles = useRoles();
  const { t } = useT();
  const [waiting, setWaiting] = useState(0);

  // Moderators see how much is waiting each time they open Me.
  useEffect(() => {
    if (!focused || !roles.is_moderator || !REVIEW_ENABLED) return;
    Promise.all([supabase.rpc('get_review_queue'), supabase.rpc('get_report_queue')]).then(([u, r]) =>
      setWaiting((u.data?.length ?? 0) + (r.data?.length ?? 0)),
    );
  }, [focused, roles.is_moderator]);

  // Fresh numbers each time the tab comes into view.
  useEffect(() => {
    if (focused) reload();
  }, [focused, reload]);

  if (!current) return <View style={styles.root} />;

  const l = lanes[current.lane];
  const isAdult = current.lane === 'adult';
  const todayMin = Math.floor(todaySeconds / 60);
  const openParent = () => {
    fx.tap();
    router.push({ pathname: '/parent', params: { child: isAdult ? undefined : current.id } });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: barSpace }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Avatar letter={current.display_name[0]?.toUpperCase() ?? '?'} tint={l.color} />
          <Enter index={1} style={{ flex: 1, gap: 6 }}>
            <Text style={styles.name} numberOfLines={1}>
              {current.display_name}
            </Text>
            <View style={[styles.lanePill, { backgroundColor: l.color }]}>
              <Text style={styles.lanePillText}>
                {t(laneKey(current.lane))} · {l.ages}
              </Text>
            </View>
          </Enter>
          {!isAdult && (
            <Enter index={2}>
              <PressScale onPress={openParent} pressedScale={0.9} accessibilityRole="button" accessibilityLabel={t('me.familyControls')} style={styles.iconButton}>
                <Icon name="sliders" size={20} />
              </PressScale>
            </Enter>
          )}
        </View>

        <View style={styles.stats}>
          <Stat index={3} value={todayMin} format={(n) => t('me.todayValue', { n })} label={t('me.stat.today')} />
          <Stat index={4} value={data?.saved ?? 0} label={t('me.stat.saved')} onPress={() => router.push('/saved')} />
          <Stat index={5} value={data?.following ?? 0} label={t('me.stat.following')} onPress={() => router.push('/following')} />
        </View>

        <Enter index={6}>
          <TasteCard taste={data?.taste ?? []} onReset={resetTaste} delay={420} />
        </Enter>

        <Enter index={7} style={styles.list}>
          {!isAdult && (
            <>
              <Row icon="shield" label={t('me.dailyLimit')} onPress={openParent}>
                {limitMinutes != null ? (
                  <View style={styles.limitValue}>
                    <Text style={styles.value}>{t('me.limitValue', { used: todayMin, limit: limitMinutes })}</Text>
                    <Ring progress={todaySeconds / (limitMinutes * 60)} color={GREEN} delay={600} />
                  </View>
                ) : (
                  <Text style={styles.value}>{t('common.off')}</Text>
                )}
              </Row>
              <Row icon="moon" label={t('me.quietHours')} onPress={openParent}>
                <Toggle on={current.quiet_hours} tint={GREEN} />
              </Row>
            </>
          )}
          {isAdult && (
            <Row icon="sliders" label={t('me.familyDashboard')} onPress={openParent}>
              <Icon name="chevron" size={16} color={color.text3} strokeWidth={2.4} />
            </Row>
          )}
          {isAdult && roles.is_creator && (
            <Row icon="plus" label={t('me.creatorStudio')} onPress={() => router.push('/studio')}>
              <Icon name="chevron" size={16} color={color.text3} strokeWidth={2.4} />
            </Row>
          )}
          {isAdult && roles.is_moderator && REVIEW_ENABLED && (
            <Row icon="shield" label={t('me.review')} onPress={() => router.push('/review')}>
              {waiting > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{waiting}</Text>
                </View>
              )}
              <Icon name="chevron" size={16} color={color.text3} strokeWidth={2.4} />
            </Row>
          )}
          <Row icon="lock" label={t('me.switchProfile')} onPress={leaveProfile}>
            <Icon name="chevron" size={16} color={color.text3} strokeWidth={2.4} />
          </Row>
          {/* Children reach Sign out through the parent PIN, so they can't sign the family out. */}
          <Row icon="close" label={t('me.signOut')} onPress={isAdult ? signOut : openParent} last>
            {!isAdult && <Icon name="shield" size={16} color={color.text3} strokeWidth={2.2} />}
            <Icon name="chevron" size={16} color={color.text3} strokeWidth={2.4} />
          </Row>
        </Enter>

        <Enter index={8}>
          <DeviceCard />
        </Enter>
      </ScrollView>
      <StatusScrim />

    </View>
  );
}

/** Sounds and vibration for this phone (every profile on it). */
function DeviceCard() {
  const { t, lang } = useT();
  const [prefs, setPrefs] = useState(getFeedbackSettings);
  const [langOpen, setLangOpen] = useState(false);
  const flip = (key: 'sound' | 'haptics') => {
    const next = { ...prefs, [key]: !prefs[key] };
    setFeedbackSettings(next);
    setPrefs(next);
    fx.toggle(next[key]); // plays/buzzes only if the setting just turned on
  };
  return (
    <View style={styles.list}>
      <Row icon="sound" label={t('me.sounds')} onPress={() => flip('sound')}>
        <Toggle on={prefs.sound} tint={GREEN} />
      </Row>
      <Row icon="vibrate" label={t('me.vibration')} onPress={() => flip('haptics')}>
        <Toggle on={prefs.haptics} tint={GREEN} />
      </Row>
      <Row
        icon="discover"
        label={t('common.language')}
        onPress={() => {
          fx.tap();
          setLangOpen(true);
        }}
        last
      >
        <Text style={styles.value} numberOfLines={1}>
          {LANGS.find((x) => x.code === lang)?.native}
        </Text>
        <Icon name="chevron" size={16} color={color.text3} strokeWidth={2.4} />
      </Row>
      <BottomSheet open={langOpen} onClose={() => setLangOpen(false)} title={t('common.language')}>
        <LanguagePicker onPicked={() => setLangOpen(false)} />
      </BottomSheet>
    </View>
  );
}

/** The avatar drops in with a little overshoot and a tilt that settles. */
function Avatar({ letter, tint }: { letter: string; tint: string }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) p.value = withDelay(60, withSpring(1, spring.bouncy));
  }, [reduce, p]);
  const anim = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 2),
    transform: [{ scale: 0.6 + 0.4 * p.value }, { rotate: `${(1 - p.value) * -14}deg` }],
  }));
  return (
    <Animated.View style={[styles.avatar, { backgroundColor: tint }, anim]}>
      <Text style={styles.avatarLetter}>{letter}</Text>
    </Animated.View>
  );
}

function Stat({ index, value, label, format = String, onPress }: { index: number; value: number; label: string; format?: (n: number) => string; onPress?: () => void }) {
  const body = (
    <>
      <CountUp value={value} format={format} delay={300 + index * 60} style={styles.statValue} />
      <View style={styles.statLabelRow}>
        <Text style={styles.statLabel}>{label}</Text>
        {onPress && <Icon name="chevron" size={12} color={color.text3} strokeWidth={2.6} />}
      </View>
    </>
  );
  return (
    <Enter index={index} style={{ flex: 1 }}>
      {onPress ? (
        <PressScale onPress={onPress} pressedScale={0.95} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={styles.stat}>
          {body}
        </PressScale>
      ) : (
        <View style={styles.stat}>{body}</View>
      )}
    </Enter>
  );
}

function Row({ icon, label, onPress, last, children }: { icon: IconName; label: string; onPress: () => void; last?: boolean; children: React.ReactNode }) {
  return (
    <PressScale onPress={onPress} pressedScale={0.98} accessibilityRole="button" accessibilityLabel={label} style={[styles.row, !last && styles.rowBorder]}>
      <Icon name={icon} size={20} color={GREEN} />
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      {children}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: color.ink, fontFamily: font.display, fontSize: 28 },
  name: { color: color.text, fontFamily: font.display, fontSize: 26, letterSpacing: -0.5 },
  lanePill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  lanePillText: { color: color.ink, fontFamily: font.bold, fontSize: 11 },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface1, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { backgroundColor: color.surface1, borderRadius: 16, padding: 12, gap: 2 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statValue: { color: color.text, fontFamily: font.mono, fontSize: 20 },
  statLabel: { color: color.text2, fontFamily: font.medium, fontSize: 12 },
  list: { backgroundColor: color.surface1, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 54 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: color.line },
  rowLabel: { flex: 1, color: color.text, fontFamily: font.semibold, fontSize: 15 },
  value: { color: color.text2, fontFamily: font.medium, fontSize: 14 },
  limitValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: color.ink, fontFamily: font.bold, fontSize: 12 },
});
