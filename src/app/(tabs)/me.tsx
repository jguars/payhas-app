import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';

import { Icon, IconName } from '@/components/Icon';
import { StatusScrim } from '@/components/StatusScrim';
import { CountUp } from '@/components/motion/CountUp';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { Ring } from '@/components/motion/Ring';
import { Toggle } from '@/components/motion/Toggle';
import { useFamily } from '@/features/family/FamilyProvider';
import { useLibrary } from '@/features/library/LibraryProvider';
import { useScreenTime } from '@/features/library/useScreenTime';
import { ControlsSheet } from '@/features/me/ControlsSheet';
import { TasteCard } from '@/features/me/TasteCard';
import { useMe } from '@/features/me/useMe';
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
  const [controlsOpen, setControlsOpen] = useState(false);

  // Fresh numbers each time the tab comes into view.
  useEffect(() => {
    if (focused) reload();
  }, [focused, reload]);

  if (!current) return <View style={styles.root} />;

  const l = lanes[current.lane];
  const isAdult = current.lane === 'adult';
  const todayMin = Math.floor(todaySeconds / 60);

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
                {l.label} · {l.ages}
              </Text>
            </View>
          </Enter>
          {!isAdult && (
            <Enter index={2}>
              <PressScale onPress={() => setControlsOpen(true)} pressedScale={0.9} accessibilityRole="button" accessibilityLabel="Family controls" style={styles.iconButton}>
                <Icon name="sliders" size={20} />
              </PressScale>
            </Enter>
          )}
        </View>

        <View style={styles.stats}>
          <Stat index={3} value={todayMin} format={(n) => `${n}m`} label="Today" />
          <Stat index={4} value={data?.saved ?? 0} label="Saved" />
          <Stat index={5} value={data?.following ?? 0} label="Following" />
        </View>

        <Enter index={6}>
          <TasteCard taste={data?.taste ?? []} onReset={resetTaste} delay={420} />
        </Enter>

        <Enter index={7} style={styles.list}>
          {!isAdult && (
            <>
              <Row icon="shield" label="Daily limit" onPress={() => setControlsOpen(true)}>
                {limitMinutes != null ? (
                  <View style={styles.limitValue}>
                    <Text style={styles.value}>
                      {todayMin} / {limitMinutes} min
                    </Text>
                    <Ring progress={todaySeconds / (limitMinutes * 60)} color={GREEN} delay={600} />
                  </View>
                ) : (
                  <Text style={styles.value}>Off</Text>
                )}
              </Row>
              <Row icon="moon" label="Quiet hours" onPress={() => setControlsOpen(true)}>
                <Toggle on={current.quiet_hours} tint={GREEN} />
              </Row>
            </>
          )}
          <Row icon="lock" label="Switch profile" onPress={leaveProfile} last={!isAdult}>
            <Icon name="chevron" size={16} color={color.text3} strokeWidth={2.4} />
          </Row>
          {isAdult && (
            <Row icon="close" label="Sign out" onPress={signOut} last>
              <Icon name="chevron" size={16} color={color.text3} strokeWidth={2.4} />
            </Row>
          )}
        </Enter>
      </ScrollView>
      <StatusScrim />

      {!isAdult && <ControlsSheet profile={current} open={controlsOpen} onClose={() => setControlsOpen(false)} />}
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

function Stat({ index, value, label, format = String }: { index: number; value: number; label: string; format?: (n: number) => string }) {
  return (
    <Enter index={index} style={styles.stat}>
      <CountUp value={value} format={format} delay={300 + index * 60} style={styles.statValue} />
      <Text style={styles.statLabel}>{label}</Text>
    </Enter>
  );
}

function Row({ icon, label, onPress, last, children }: { icon: IconName; label: string; onPress: () => void; last?: boolean; children: React.ReactNode }) {
  return (
    <PressScale onPress={onPress} pressedScale={0.98} accessibilityRole="button" accessibilityLabel={label} style={[styles.row, !last && styles.rowBorder]}>
      <Icon name={icon} size={20} color={GREEN} />
      <Text style={styles.rowLabel}>{label}</Text>
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
  stat: { flex: 1, backgroundColor: color.surface1, borderRadius: 16, padding: 12, gap: 2 },
  statValue: { color: color.text, fontFamily: font.mono, fontSize: 20 },
  statLabel: { color: color.text2, fontFamily: font.medium, fontSize: 12 },
  list: { backgroundColor: color.surface1, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 54 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: color.line },
  rowLabel: { flex: 1, color: color.text, fontFamily: font.semibold, fontSize: 15 },
  value: { color: color.text2, fontFamily: font.medium, fontSize: 14 },
  limitValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
