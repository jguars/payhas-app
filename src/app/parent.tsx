import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { Ring } from '@/components/motion/Ring';
import { Toggle } from '@/components/motion/Toggle';
import { PinPad } from '@/components/PinPad';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import { REASON_LABEL } from '@/features/creator/useReviewQueue';
import { mediaFor, signMedia } from '@/features/feed/data';
import { hourLabel } from '@/features/library/useScreenTime';
import { Child, Controls, minutes, presence, RecentRow, useParent } from '@/features/parent/useParent';
import { fx } from '@/lib/feedback';
import { useInsets } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { color, font, lane as lanes, radius, space } from '@/theme/tokens';

const GREEN = '#4FE3B0';
const RED = '#FF8A73';
const LIMITS: (number | null)[] = [null, 15, 30, 45, 60, 90, 120];
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The parent's remote: one PIN opens 15 minutes of control over every child
 * profile. Changes apply on the child's device within a second or two.
 */
export default function ParentScreen() {
  const { child: initial } = useLocalSearchParams<{ child?: string }>();
  const { unlocked, children, unlock, lock, setControls, setPaused, addTime, hideVideo } = useParent();
  const { bottom } = useInsets();
  const toast = useToast();
  const [selected, setSelected] = useState<string | undefined>(initial);
  const [hiding, setHiding] = useState<RecentRow | null>(null);

  if (!unlocked) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Family" />
        <View style={styles.pinWrap}>
          <PinPad title="Parent PIN" onComplete={unlock} onCancel={() => router.back()} />
          <Text style={styles.pinHint}>Unlocks the dashboard for 15 minutes.</Text>
        </View>
      </View>
    );
  }

  const child = children?.find((c) => c.id === selected) ?? children?.[0];

  const done = (ok: boolean, text: string) => {
    if (!ok) {
      fx.error();
      toast({ text: 'Couldn’t reach Payhas — try again', icon: 'close' });
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
      <ScreenHeader title="Family" />

      {children && children.length === 0 && (
        <Enter index={0} style={styles.empty}>
          <Text style={styles.emptyTitle}>No children’s profiles yet</Text>
          <Text style={styles.emptySub}>Add a Little, Kids or Teen profile from “Who’s watching?” to manage it here.</Text>
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
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      if (!on) fx.tab();
                      setSelected(c.id);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[styles.pick, on && { borderColor: L.color, backgroundColor: L.color + '1F' }]}
                  >
                    <View style={[styles.pickAvatar, { backgroundColor: L.color }]}>
                      <Text style={styles.pickLetter}>{c.display_name[0]?.toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.pickName, on && { color: color.text }]}>{c.display_name}</Text>
                    {presence(c).live && <LiveDot />}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Hero
            key={child.id}
            child={child}
            onPause={async () => {
              const next = !child.paused;
              next ? fx.longPress() : fx.tap();
              done(await setPaused(child, next), next ? `${child.display_name} is paused` : `${child.display_name} can watch again`);
            }}
            onAddTime={async () => {
              fx.tap();
              done(await addTime(child, 15), `+15 min for ${child.display_name} today`);
            }}
          />

          <Enter index={2}>
            <WeekChart key={child.id} child={child} />
          </Enter>

          <Enter index={3} style={styles.card}>
            <Text style={styles.cardTitle}>Rules</Text>
            <View style={{ gap: space.sm }}>
              <Text style={styles.label}>Daily limit</Text>
              <Segmented
                options={LIMITS}
                value={child.daily_limit_minutes}
                label={(l) => (l == null ? 'Off' : String(l))}
                onChange={(l) => change(child, { daily_limit_minutes: l }, l == null ? 'Daily limit off' : `Daily limit ${l} min`)}
              />
            </View>

            <ToggleRow
              label="Quiet hours"
              sub={`No videos or games ${hourLabel(child.bedtime_hour)} – ${hourLabel(child.wake_hour)}`}
              on={child.quiet_hours}
              onPress={() => change(child, { quiet_hours: !child.quiet_hours }, child.quiet_hours ? 'Quiet hours off' : 'Quiet hours on')}
            />
            {child.quiet_hours && (
              <View style={styles.hours}>
                <HourStepper label="Bedtime" value={child.bedtime_hour} onChange={(h) => change(child, { bedtime_hour: h }, `Bedtime ${hourLabel(h)}`)} />
                <HourStepper label="Wake up" value={child.wake_hour} onChange={(h) => change(child, { wake_hour: h }, `Wake up ${hourLabel(h)}`)} />
              </View>
            )}

            <ToggleRow
              label="Games"
              sub="Bubble Pop and Memory Match"
              on={child.games_enabled}
              onPress={() => change(child, { games_enabled: !child.games_enabled }, child.games_enabled ? 'Games off' : 'Games on')}
            />
          </Enter>

          <Enter index={4}>
            <Watching child={child} onHide={setHiding} />
          </Enter>

          <Enter index={5}>
            <PressScale
              onPress={() => {
                fx.tap();
                lock();
                router.back();
              }}
              accessibilityRole="button"
              style={styles.lockButton}
            >
              <Icon name="lock" size={16} color={color.text2} strokeWidth={2.2} />
              <Text style={styles.lockText}>Lock dashboard</Text>
            </PressScale>
          </Enter>
        </ScrollView>
      )}

      <BottomSheet open={!!hiding} onClose={() => setHiding(null)} title={child ? `Hide from ${child.display_name}?` : ''}>
        <View style={{ gap: space.md, paddingHorizontal: space.xl }}>
          <Text style={styles.sheetCaption} numberOfLines={2}>
            “{hiding?.caption}”
          </Text>
          <Text style={styles.sheetSub}>It won’t show up in their feed, search or saved videos again. Other profiles aren’t affected.</Text>
          <PressScale
            onPress={async () => {
              const v = hiding;
              setHiding(null);
              if (child && v) done(await hideVideo(child, v.id), 'Hidden');
            }}
            accessibilityRole="button"
            style={styles.hideButton}
          >
            <Icon name="eyeOff" size={18} color={color.ink} strokeWidth={2.4} />
            <Text style={styles.hideText}>Hide this video</Text>
          </PressScale>
        </View>
      </BottomSheet>
    </View>
  );
}

/** Today at a glance: the ring, live status, and the two remote buttons. */
function Hero({ child, onPause, onAddTime }: { child: Child; onPause: () => void; onAddTime: () => void }) {
  const L = lanes[child.lane];
  const today = child.week[child.week.length - 1];
  const used = (today?.video_s ?? 0) + (today?.game_s ?? 0);
  const limit = child.daily_limit_minutes == null ? null : child.daily_limit_minutes + child.extra_minutes;
  const p = presence(child);

  return (
    <Enter index={1} style={[styles.card, styles.hero]}>
      <View style={styles.heroTop}>
        <View style={styles.ringWrap}>
          <Ring progress={limit ? used / (limit * 60) : 0} size={112} stroke={9} color={child.paused ? color.verified : limit && used >= limit * 60 ? RED : GREEN} delay={200} />
          <View style={styles.ringLabel}>
            <Text style={styles.ringValue}>{minutes(used)}</Text>
            <Text style={styles.ringSub}>{limit ? `of ${limit}m` : 'today'}</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.heroName} numberOfLines={1}>
            {child.display_name}
          </Text>
          <View style={[styles.lanePill, { backgroundColor: L.color }]}>
            <Text style={styles.lanePillText}>
              {L.label} · {L.ages}
            </Text>
          </View>
          <View style={styles.statusRow}>
            {child.paused ? <Icon name="pause" size={12} color={color.verified} strokeWidth={3} /> : p.live && <LiveDot />}
            <Text style={[styles.status, child.paused ? { color: color.verified } : p.live && { color: GREEN }]}>{child.paused ? 'Paused' : p.text}</Text>
          </View>
          {child.extra_minutes > 0 && <Text style={styles.extra}>+{child.extra_minutes} min extra today</Text>}
        </View>
      </View>

      <View style={styles.actions}>
        <PressScale onPress={onPause} accessibilityRole="button" style={[styles.action, child.paused ? styles.resume : styles.pause]}>
          <Icon name={child.paused ? 'play' : 'pause'} size={18} color={color.ink} strokeWidth={2.8} />
          <Text style={styles.actionTextInk}>{child.paused ? 'Resume' : 'Pause now'}</Text>
        </PressScale>
        <PressScale onPress={onAddTime} disabled={limit == null} accessibilityRole="button" style={[styles.action, styles.addTime, limit == null && { opacity: 0.4 }]}>
          <Icon name="plus" size={18} color={color.text} strokeWidth={2.6} />
          <Text style={styles.actionText}>15 min</Text>
        </PressScale>
      </View>
    </Enter>
  );
}

/** Seven stacked bars (videos + games), rising one after another. */
function WeekChart({ child }: { child: Child }) {
  const total = child.week.reduce((n, d) => n + d.video_s + d.game_s, 0);
  const max = Math.max(1, ...child.week.map((d) => d.video_s + d.game_s), (child.daily_limit_minutes ?? 0) * 60);
  const limitY = child.daily_limit_minutes ? (child.daily_limit_minutes * 60) / max : null;

  return (
    <View style={styles.card}>
      <View style={styles.chartHead}>
        <Text style={styles.cardTitle}>This week</Text>
        <Text style={styles.chartTotal}>
          {minutes(total)} · {minutes(total / 7)}/day
        </Text>
      </View>
      <View style={styles.chart}>
        {limitY != null && <View style={[styles.limitLine, { bottom: 22 + limitY * CHART_H }]} />}
        {child.week.map((d, i) => {
          const isToday = i === child.week.length - 1;
          return (
            <View key={d.day} style={styles.barCol}>
              <Bar index={i} video={d.video_s / max} game={d.game_s / max} today={isToday} />
              <Text style={[styles.dayLetter, isToday && { color: color.text }]}>{DAY_LETTER[new Date(d.day + 'T12:00:00').getDay()]}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={[styles.swatch, { backgroundColor: GREEN }]} />
        <Text style={styles.legendText}>Videos</Text>
        <View style={[styles.swatch, { backgroundColor: '#FFD25E' }]} />
        <Text style={styles.legendText}>Games</Text>
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
      <Animated.View style={[styles.bar, { height: h, opacity: today ? 1 : 0.7, transformOrigin: 'bottom' }, anim]}>
        {video + game === 0 ? (
          <View style={{ flex: 1, backgroundColor: color.line }} />
        ) : (
          <>
            <View style={{ flex: game, backgroundColor: '#FFD25E' }} />
            <View style={{ flex: video, backgroundColor: GREEN }} />
          </>
        )}
      </Animated.View>
    </View>
  );
}

/** What the child has been watching: top topics, anything they flagged, recent videos. */
function Watching({ child, onHide }: { child: Child; onHide: (v: RecentRow) => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const signed = useRef('');
  useEffect(() => {
    const key = child.recent.map((r) => r.id).join();
    if (key === signed.current) return;
    signed.current = key;
    signMedia(child.recent).then(setUrls);
  }, [child.recent]);

  const topicTotal = child.topics.reduce((n, t) => n + t.seconds, 0) || 1;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>What {child.display_name} watched</Text>

      {child.flags.length > 0 &&
        child.flags.map((f) => (
          <View key={f.video_id + f.at} style={styles.flag}>
            <Icon name="flag" size={14} color={RED} />
            <Text style={styles.flagText} numberOfLines={2}>
              Flagged “{f.caption}” as {(REASON_LABEL[f.reason] ?? f.reason).toLowerCase()} — it’s hidden and with our moderators.
            </Text>
          </View>
        ))}

      {child.topics.length === 0 ? (
        <Text style={styles.muted}>Nothing watched this week yet.</Text>
      ) : (
        <View style={{ gap: space.sm }}>
          {child.topics.map((t, i) => (
            <TopicBar key={t.slug} index={i} emoji={t.emoji} label={t.label} share={t.seconds / topicTotal} time={minutes(t.seconds)} />
          ))}
        </View>
      )}

      {child.recent.length > 0 && (
        <>
          <Text style={[styles.label, { marginTop: space.sm }]}>Recent videos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {child.recent.map((r) => {
              const m = mediaFor(r, urls);
              return (
                <PressScale
                  key={r.id}
                  disabled={r.hidden}
                  onPress={() => {
                    fx.tap();
                    onHide(r);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.caption}${r.hidden ? ', hidden' : ''}`}
                  style={styles.recent}
                >
                  {m ? <Image source={m.thumb} style={[styles.recentThumb, r.hidden && { opacity: 0.3 }]} /> : <View style={styles.recentThumb} />}
                  {r.hidden && (
                    <View style={styles.hiddenBadge}>
                      <Icon name="eyeOff" size={18} color={color.text} strokeWidth={2.2} />
                    </View>
                  )}
                  <Text style={styles.recentCaption} numberOfLines={2}>
                    {r.caption}
                  </Text>
                </PressScale>
              );
            })}
          </ScrollView>
          <Text style={styles.muted}>Tap a video to hide it from {child.display_name}.</Text>
        </>
      )}
    </View>
  );
}

function TopicBar({ index, emoji, label, share, time }: { index: number; emoji: string; label: string; share: number; time: string }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) s.value = withDelay(300 + index * 60, withSpring(1, spring.smooth));
  }, [index, reduce, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scaleX: s.value * Math.max(0.04, share) }] }));
  return (
    <View style={styles.topicRow}>
      <Text style={styles.topicEmoji}>{emoji}</Text>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.topicHead}>
          <Text style={styles.topicLabel}>{label}</Text>
          <Text style={styles.topicTime}>{time}</Text>
        </View>
        <View style={styles.topicTrack}>
          <Animated.View style={[styles.topicFill, { transformOrigin: 'left' }, anim]} />
        </View>
      </View>
    </View>
  );
}

function ToggleRow({ label, sub, on, onPress }: { label: string; sub: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        fx.toggle(!on);
        onPress();
      }}
      style={styles.toggleRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Toggle on={on} tint={GREEN} />
    </Pressable>
  );
}

/** − 8pm + ; saves 600ms after the last tap so quick taps don't each notify the child. */
function HourStepper({ label, value, onChange }: { label: string; value: number; onChange: (h: number) => void }) {
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
        <PressScale onPress={() => step(-1)} pressedScale={0.85} accessibilityRole="button" accessibilityLabel={`${label} earlier`} style={styles.stepButton}>
          <Icon name="minus" size={16} strokeWidth={2.6} />
        </PressScale>
        <Text style={styles.stepValue}>{hourLabel(h)}</Text>
        <PressScale onPress={() => step(1)} pressedScale={0.85} accessibilityRole="button" accessibilityLabel={`${label} later`} style={styles.stepButton}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingBottom: 80 },
  pinHint: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  content: { paddingHorizontal: space.lg, gap: space.md },
  empty: { alignItems: 'center', gap: space.sm, paddingTop: 120, paddingHorizontal: space.xl },
  emptyTitle: { color: color.text, fontFamily: font.title, fontSize: 20, textAlign: 'center' },
  emptySub: { color: color.text2, fontFamily: font.medium, fontSize: 14, textAlign: 'center' },

  picker: { gap: space.sm, paddingBottom: space.xs },
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 44, paddingLeft: 6, paddingRight: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.line, backgroundColor: color.surface1 },
  pickAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pickLetter: { color: color.ink, fontFamily: font.bold, fontSize: 14 },
  pickName: { color: color.text2, fontFamily: font.semibold, fontSize: 14 },

  card: { backgroundColor: color.surface1, borderRadius: 24, padding: space.lg, gap: space.md },
  cardTitle: { color: color.text, fontFamily: font.title, fontSize: 18 },
  hero: { gap: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  ringWrap: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', alignItems: 'center' },
  ringValue: { color: color.text, fontFamily: font.mono, fontSize: 20 },
  ringSub: { color: color.text3, fontFamily: font.medium, fontSize: 12 },
  heroName: { color: color.text, fontFamily: font.display, fontSize: 26, letterSpacing: -0.5 },
  lanePill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  lanePillText: { color: color.ink, fontFamily: font.bold, fontSize: 11 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { color: color.text3, fontFamily: font.semibold, fontSize: 13 },
  extra: { color: '#FFD25E', fontFamily: font.semibold, fontSize: 12 },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 52, borderRadius: radius.pill },
  pause: { flex: 1.4, backgroundColor: color.ember },
  resume: { flex: 1.4, backgroundColor: GREEN },
  addTime: { flex: 1, backgroundColor: color.surface2 },
  actionTextInk: { color: color.ink, fontFamily: font.bold, fontSize: 16 },
  actionText: { color: color.text, fontFamily: font.bold, fontSize: 16 },

  chartHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  chartTotal: { color: color.text3, fontFamily: font.mono, fontSize: 12 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: space.sm },
  limitLine: { position: 'absolute', left: 0, right: 0, height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: RED, opacity: 0.6 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  bar: { width: 22, borderRadius: 7, overflow: 'hidden' },
  dayLetter: { color: color.text3, fontFamily: font.mono, fontSize: 11, height: 16 },
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

  flag: { flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.md, borderRadius: 14, backgroundColor: 'rgba(255,138,115,0.1)' },
  flagText: { flex: 1, color: RED, fontFamily: font.semibold, fontSize: 13 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  topicEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  topicHead: { flexDirection: 'row', justifyContent: 'space-between' },
  topicLabel: { color: color.text, fontFamily: font.semibold, fontSize: 14 },
  topicTime: { color: color.text3, fontFamily: font.mono, fontSize: 12 },
  topicTrack: { height: 6, borderRadius: 3, backgroundColor: color.surface2, overflow: 'hidden' },
  topicFill: { height: 6, borderRadius: 3, backgroundColor: GREEN, width: '100%' },
  recent: { width: 92, gap: 6 },
  recentThumb: { width: 92, height: 124, borderRadius: 12, backgroundColor: color.surface2 },
  hiddenBadge: { position: 'absolute', top: 0, left: 0, width: 92, height: 124, alignItems: 'center', justifyContent: 'center' },
  recentCaption: { color: color.text2, fontFamily: font.medium, fontSize: 12 },

  lockButton: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: space.sm, height: 44, paddingHorizontal: space.lg, marginTop: space.sm },
  lockText: { color: color.text2, fontFamily: font.semibold, fontSize: 14 },

  sheetCaption: { color: color.text, fontFamily: font.bold, fontSize: 16 },
  sheetSub: { color: color.text2, fontFamily: font.medium, fontSize: 14 },
  hideButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 52, borderRadius: radius.pill, backgroundColor: color.ember, marginTop: space.sm },
  hideText: { color: color.ink, fontFamily: font.bold, fontSize: 16 },

  liveDot: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveHalo: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },
  liveCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
});
