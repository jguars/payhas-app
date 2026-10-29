import { router } from 'expo-router';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextStyle, View } from 'react-native';
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

import { Icon, IconName } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { Toggle } from '@/components/motion/Toggle';
import { IconCircle } from '@/components/ui/IconCircle';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { reasonLabel } from '@/features/creator/useReviewQueue';
import { mediaFor, signMedia } from '@/features/feed/data';
import { hourLabel } from '@/features/library/useScreenTime';
import { ago, Child, minutes, RecentRow } from '@/features/parent/useParent';
import { localized, topicLabel, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { alpha, color, font, lane as lanes, pageFill, radius, size, space, themedStyles } from '@/theme/tokens';

/**
 * Pieces of the parent dashboard shared by the Family screen (parent.tsx) and
 * a child's page (parent-child.tsx). Layout follows the family hubs and time
 * pages of YouTube Family Center, Spotify Kids, Instagram and Whatnot: a calm
 * list of people, one big number, and settings as grouped rows.
 */

/** Latest rows shown before "See all". */
const LATEST_FOLD = 5;

/** A slim track whose fill springs out from the left (transform only). */
export function Meter({ progress, tint }: { progress: number; tint: string }) {
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
export function RequestCard({ name, at, onAnswer }: { name: string; at: string; onAnswer: (m: number | null) => void }) {
  const { t } = useT();
  const mins = Math.max(1, Math.round((Date.now() - new Date(at).getTime()) / 60_000));
  return (
    <Enter index={0} rise={8} style={styles.request}>
      <View style={styles.requestHead}>
        <IconCircle icon="clock" tint={color.warning} size={32} />
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

/** Seven stacked bars (videos + games), rising one after another, under a big weekly total. */
export function WeekChart({ child }: { child: Child }) {
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
        <View style={[styles.swatch, { backgroundColor: color.success }]} />
        <Text style={styles.legendText}>{t('parent.videos')}</Text>
        <View style={[styles.swatch, { backgroundColor: color.warning }]} />
        <Text style={styles.legendText}>{t('parent.games')}</Text>
      </View>
    </View>
  );
}

const CHART_H = 110;

export function Bar({ index, video, game, today }: { index: number; video: number; game: number; today: boolean }) {
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
            <View style={{ flex: game, backgroundColor: color.warning }} />
            <View style={{ flex: video, backgroundColor: color.success }} />
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
export function Latest({ child, onHide }: { child: Child; onHide: (v: RecentRow) => void }) {
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
                    <IconCircle icon="flag" tint={color.danger} size={40} />
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
                    <IconCircle icon="sparkle" tint={color.success} size={40} />
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
export function Rich({ text, values, bold, style, lines }: { text: string; values: Record<string, string>; bold: string[]; style: TextStyle; lines?: number }) {
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
export function HourStepper({ label, value, onChange }: { label: string; value: number; onChange: (h: number) => void }) {
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
export function LiveDot() {
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
export function confirmDestructive(title: string, body: string, action: string, cancel: string, onYes: () => void) {
  fx.tap();
  if (Platform.OS === 'web') return window.confirm(`${title}\n\n${body}`) && onYes();
  Alert.alert(title, body, [
    { text: cancel, style: 'cancel' },
    { text: action, style: 'destructive', onPress: onYes },
  ]);
}


/** A titled group of rows on one rounded card (settings-list style). */
export function Group({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  return (
    <View style={{ gap: space.sm }}>
      {!!title && <Text style={styles.groupTitle}>{title}</Text>}
      <View style={styles.group}>{children}</View>
      {!!footer && <Text style={styles.groupFooter}>{footer}</Text>}
    </View>
  );
}

/**
 * One settings row: an optional leading element, a label with an optional
 * line under it, and on the right a value, a toggle or a chevron.
 */
export function Row({
  leading,
  label,
  sub,
  value,
  toggle,
  onPress,
  danger,
  first,
  chevron = !!onPress && !toggle,
  accessibilityLabel,
}: {
  leading?: ReactNode;
  label: string;
  sub?: ReactNode;
  value?: ReactNode;
  toggle?: boolean;
  onPress?: () => void;
  danger?: boolean;
  first?: boolean;
  chevron?: boolean;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowLabel, danger && { color: color.danger }]} numberOfLines={1}>
          {label}
        </Text>
        {typeof sub === 'string' ? (
          <Text style={styles.rowSub} numberOfLines={2}>
            {sub}
          </Text>
        ) : (
          sub
        )}
      </View>
      {typeof value === 'string' ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        value
      )}
      {toggle != null && <Toggle on={toggle} tint={color.success} />}
      {chevron && <Icon name="chevron" size={18} color={color.text3} strokeWidth={2.4} />}
    </>
  );
  const style = [styles.row, !first && styles.rowLine];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      onPress={() => {
        if (toggle != null) fx.toggle(!toggle);
        else fx.tap();
        onPress();
      }}
      accessibilityRole={toggle != null ? 'switch' : 'button'}
      accessibilityState={toggle != null ? { checked: toggle } : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [style, pressed && { backgroundColor: color.surface2 }]}
    >
      {body}
    </Pressable>
  );
}

/** Free plan: where the week and recent videos would be, one card that says they come with Plus. */
export function LockedHistory() {
  const { t } = useT();
  return (
    <PressScale onPress={() => router.push('/plus')} accessibilityRole="button" style={[styles.card, styles.locked]}>
      <Icon name="lock" size={22} color={color.text2} strokeWidth={2.2} />
      <Text style={styles.lockedTitle}>{t('plus.lockedHistoryTitle')}</Text>
      <Text style={[styles.sub, { textAlign: 'center' }]}>{t('plus.lockedHistorySub')}</Text>
      <Text style={styles.planCta}>{t('plus.dashCta')}</Text>
    </PressScale>
  );
}

/**
 * Today at a glance (after Instagram's Time management and Whatnot's Watch
 * Time): one big number against the limit, a slim bar, and the two remote
 * buttons — pause now and fifteen more minutes.
 */
export function TodayCard({ child, onPause, onAddTime }: { child: Child; onPause: () => void; onAddTime: () => void }) {
  const { t } = useT();
  const today = child.week[child.week.length - 1];
  const used = (today?.video_s ?? 0) + (today?.game_s ?? 0);
  const limit = child.daily_limit_minutes == null ? null : child.daily_limit_minutes + child.extra_minutes;
  const reached = limit != null && used >= limit * 60;
  return (
    <View style={[styles.card, { gap: space.lg }]}>
      <View style={{ gap: space.sm }}>
        <Text style={styles.overline}>{t('parent.watchTime')}</Text>
        <View style={styles.bigRow}>
          <Text style={[styles.bigValue, reached && { color: color.danger }]} numberOfLines={1}>
            {minutes(t, used)}
          </Text>
          <Text style={styles.bigOf} numberOfLines={1}>
            {limit ? t('parent.ofLimit', { limit: minutes(t, limit * 60) }) : t('parent.noLimit')}
          </Text>
        </View>
        {limit != null && <Meter progress={used / (limit * 60)} tint={child.paused ? color.verified : reached ? color.danger : color.ember} />}
        {child.extra_minutes > 0 && <Text style={styles.extra}>{t('parent.extraToday', { count: child.extra_minutes })}</Text>}
      </View>
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
    </View>
  );
}

/** A thin progress bar for a row ("35m of 1h"): ember while there's time left, red at the limit. */
export function MiniMeter({ progress }: { progress: number }) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View style={styles.miniTrack}>
      <View style={[styles.miniFill, { width: `${Math.max(4, p * 100)}%`, backgroundColor: p >= 1 ? color.danger : color.ember }]} />
    </View>
  );
}

/** A little icon tile for settings rows. */
export function RowIcon({ icon, tint }: { icon: IconName; tint: string }) {
  return (
    <View style={[styles.rowIcon, { backgroundColor: alpha(tint, 0.16) }]}>
      <Icon name={icon} size={18} color={tint} strokeWidth={2.2} />
    </View>
  );
}

const styles = themedStyles(() => ({
  groupTitle: { color: color.text2, fontFamily: font.bold, fontSize: size.small, letterSpacing: 0.3, paddingHorizontal: space.xs },
  group: { backgroundColor: color.surface1, borderRadius: 24, overflow: 'hidden' },
  groupFooter: { color: color.text3, fontFamily: font.medium, fontSize: size.caption, lineHeight: 17, paddingHorizontal: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  rowLabel: { color: color.text, fontFamily: font.semibold, fontSize: size.body },
  rowSub: { color: color.text3, fontFamily: font.medium, fontSize: size.small },
  rowValue: { color: color.text2, fontFamily: font.mono, fontSize: size.small },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  miniTrack: { height: 4, borderRadius: 2, backgroundColor: color.surface2, overflow: 'hidden' },
  miniFill: { height: 4, borderRadius: 2 },

  accountRow: { flexDirection: 'row', gap: space.sm },
  accountButton: { flex: 1, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surface1 },
  root: { flex: 1, ...pageFill() },
  pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingBottom: 80 },
  pinHint: { color: color.text3, fontFamily: font.medium, fontSize: size.small },
  content: { paddingHorizontal: space.lg, gap: space.md },
  section: { marginTop: space.md },
  empty: { alignItems: 'center', gap: space.sm, paddingTop: 120, paddingHorizontal: space.xl },
  emptyTitle: { color: color.text, fontFamily: font.title, fontSize: size.title, textAlign: 'center' },
  emptySub: { color: color.text2, fontFamily: font.medium, fontSize: size.small, textAlign: 'center' },

  picker: { gap: space.sm, paddingBottom: space.xs },
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 46, paddingLeft: 6, paddingRight: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.line, backgroundColor: color.surface1 },
  pickName: { color: color.text2, fontFamily: font.semibold, fontSize: size.small },

  card: { backgroundColor: color.surface1, borderRadius: 24, padding: space.lg, gap: space.md },
  planCard: { flexDirection: 'row', alignItems: 'center', minHeight: 72 },
  planCta: { color: color.ember, fontFamily: font.bold, fontSize: size.small },
  locked: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.line },
  lockedTitle: { color: color.text, fontFamily: font.title, fontSize: size.lead, textAlign: 'center' },
  hero: { gap: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroName: { flexShrink: 1, color: color.text, fontFamily: font.display, fontSize: size.heading, letterSpacing: -0.5 },
  lanePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  lanePillText: { color: color.ink, fontFamily: font.bold, fontSize: size.caption },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { color: color.text3, fontFamily: font.semibold, fontSize: size.small },
  overline: { color: color.text3, fontFamily: font.semibold, fontSize: size.small },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  bigValue: { color: color.text, fontFamily: font.mono, fontSize: size.display, letterSpacing: -1 },
  bigOf: { flexShrink: 1, color: color.text3, fontFamily: font.mono, fontSize: size.body },
  weekValue: { color: color.text, fontFamily: font.mono, fontSize: size.heading, letterSpacing: -0.6 },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: color.surface2, overflow: 'hidden' },
  meterFill: { height: 8, width: '100%', borderRadius: 4 },
  extra: { color: color.warning, fontFamily: font.semibold, fontSize: size.caption },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 52, borderRadius: radius.pill },
  pause: { flex: 1.4, backgroundColor: color.ember },
  resume: { flex: 1.4, backgroundColor: color.success },
  addTime: { flex: 1, backgroundColor: color.surface2 },
  actionTextInk: { color: color.ink, fontFamily: font.bold, fontSize: size.body },
  actionText: { color: color.text, fontFamily: font.bold, fontSize: size.body },

  ruleCard: { backgroundColor: color.surface1, borderRadius: 24, padding: space.lg, gap: space.md },
  ruleHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  ruleTitle: { flex: 1, color: color.text, fontFamily: font.title, fontSize: size.lead },
  ruleValue: { color: color.text, fontFamily: font.mono, fontSize: size.lead },
  ruleMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  metaDivider: { width: 1.5, height: 14, borderRadius: 1, backgroundColor: color.line },
  metaText: { flex: 1, color: color.text3, fontFamily: font.medium, fontSize: size.small },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontFamily: font.bold, fontSize: size.caption },

  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: space.sm },
  limitLine: { position: 'absolute', left: 0, right: 0, height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: color.danger, opacity: 0.6 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  bar: { width: 22, borderRadius: 8, overflow: 'hidden' },
  dayLetter: { color: color.text3, fontFamily: font.mono, fontSize: size.caption, height: 16 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  legendText: { color: color.text3, fontFamily: font.medium, fontSize: size.caption },

  label: { color: color.text, fontFamily: font.semibold, fontSize: size.body },
  sub: { color: color.text3, fontFamily: font.medium, fontSize: size.small },
  muted: { color: color.text3, fontFamily: font.medium, fontSize: size.small },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 2 },
  hours: { flexDirection: 'row', gap: space.sm },
  stepper: { flex: 1, padding: space.md, borderRadius: 16, backgroundColor: color.bg, gap: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: color.text, fontFamily: font.mono, fontSize: size.lead },

  latestRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 20, backgroundColor: color.surface1 },
  latestFlag: { backgroundColor: alpha(color.danger, 0.1) },
  latestBody: { flex: 1, gap: 3 },
  latestText: { color: color.text2, fontFamily: font.medium, fontSize: size.body, lineHeight: 20 },
  bold: { color: color.text, fontFamily: font.bold },
  latestSub: { color: color.text3, fontFamily: font.medium, fontSize: size.caption },
  latestThumb: { width: 40, height: 54, borderRadius: 8, backgroundColor: color.surface2 },

  lockButton: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.lg, marginTop: space.sm },
  lockText: { color: color.text2, fontFamily: font.semibold, fontSize: size.small },
  deleteLink: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', paddingHorizontal: space.lg, marginTop: space.xs },
  deleteText: { color: color.text3, fontFamily: font.semibold, fontSize: size.small, textDecorationLine: 'underline' },

  sheetCaption: { color: color.text, fontFamily: font.bold, fontSize: size.body },
  sheetSub: { color: color.text2, fontFamily: font.medium, fontSize: size.small },
  hideButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 52, borderRadius: radius.pill, backgroundColor: color.ember, marginTop: space.sm },
  hideText: { color: color.ink, fontFamily: font.bold, fontSize: size.body },

  request: { padding: space.md, borderRadius: 18, backgroundColor: alpha(color.reward, 0.1), borderWidth: 1, borderColor: alpha(color.reward, 0.35), gap: space.md },
  requestHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  requestTitle: { flex: 1, color: color.text, fontFamily: font.semibold, fontSize: size.small },
  requestAgo: { color: color.text3, fontFamily: font.medium },
  requestActions: { flexDirection: 'row', gap: space.sm },
  requestButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  requestYes: { backgroundColor: color.warning },
  requestYesText: { color: color.ink, fontFamily: font.bold, fontSize: size.small },
  requestNoText: { color: color.text, fontFamily: font.semibold, fontSize: size.small },
  liveDot: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveHalo: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: color.success },
  liveCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.success },
}));
