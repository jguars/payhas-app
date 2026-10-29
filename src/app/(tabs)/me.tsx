import { router, useIsFocused } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon, IconName } from '@/components/Icon';
import { LanguagePicker } from '@/components/LanguagePicker';
import { CountUp } from '@/components/motion/CountUp';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { Ring } from '@/components/motion/Ring';
import { Toggle } from '@/components/motion/Toggle';
import { StatusScrim } from '@/components/StatusScrim';
import { Avatar } from '@/components/ui/Avatar';
import { useRoles } from '@/features/creator/useRoles';
import { REVIEW_ENABLED } from '@/features/creator/useReviewQueue';
import { useFamily } from '@/features/family/FamilyProvider';
import { FeedVideo, formatCount } from '@/features/feed/data';
import { openVideo } from '@/features/feed/openVideo';
import { useLibrary } from '@/features/library/LibraryProvider';
import { useScreenTime } from '@/features/library/useScreenTime';
import { TasteCard } from '@/features/me/TasteCard';
import { useMe, useSavedPreview } from '@/features/me/useMe';
import { laneKey, LANGS, TKey, useT } from '@/i18n';
import { fx, getFeedbackSettings, setFeedbackSettings } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { alpha, color, font, lane as lanes, radius, space } from '@/theme/tokens';

const GREEN = lanes.kids.color;
const GRID_GAP = 6;
const AVATAR = 124;
const RING = 152;
/** The next lane's colour gives the glow a second hue that still belongs to the palette. */
const SECOND: Record<string, string> = { little: lanes.kids.color, kids: lanes.teen.color, teen: lanes.adult.color, adult: color.ember };
/** What each lane is told the parent can see (adult profiles aren't monitored and never show it). */
const PARENT_SEES = { little: 'me.parentSeesLittle', kids: 'me.parentSeesKids', teen: 'me.parentSeesTeen', adult: 'me.parentSeesTeen' } as const;

type Tab = 'saved' | 'taste';

/**
 * Profile. A lane-coloured glow behind a big avatar whose ring fills with
 * today's screen time; a frosted stats card; Saved / Taste behind a sliding
 * switch; settings as grouped lists. Scrolling parallaxes the hero away and
 * fades in a compact header.
 */
export default function MeScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const { current, leaveProfile, signOut } = useFamily();
  const { todaySeconds } = useLibrary();
  const { limitMinutes } = useScreenTime();
  const { data, reload, resetTaste } = useMe();
  const saved = useSavedPreview(9);
  const roles = useRoles();
  const { t } = useT();
  const [waiting, setWaiting] = useState(0);
  const [tab, setTab] = useState<Tab>('saved');
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });

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

  // Hero drifts up slower than the page and fades; the avatar shrinks a little.
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 220], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(y.value, [-120, 0, 260], [-30, 0, 90], Extrapolation.CLAMP) },
      { scale: interpolate(y.value, [-120, 0, 260], [1.08, 1, 0.82], Extrapolation.CLAMP) },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 320], [1, 0.15], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [-120, 0, 400], [0, 0, -160], Extrapolation.CLAMP) }],
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [190, 250], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [190, 250], [-8, 0], Extrapolation.CLAMP) }],
  }));

  if (!current) return <View style={styles.root} />;

  const l = lanes[current.lane];
  const isAdult = current.lane === 'adult';
  const todayMin = Math.floor(todaySeconds / 60);
  const ringProgress = limitMinutes ? todaySeconds / (limitMinutes * 60) : 0;
  const joined = new Date(current.created_at);
  const joinedText = t('me.joined', { date: `${t(`onboarding.m${joined.getMonth() + 1}` as TKey)} ${joined.getFullYear()}` });
  const openParent = () => {
    fx.tap();
    router.push({ pathname: '/parent', params: { child: isAdult ? undefined : current.id } });
  };
  const chevron = <Icon name="chevron" size={15} color={color.text3} strokeWidth={2.4} />;

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.glowWrap, glowStyle]} pointerEvents="none">
        <Glow tint={l.color} second={SECOND[current.lane]} height={insets.top + 460} />
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 56, paddingBottom: barSpace + space.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View style={[styles.hero, heroStyle]}>
          <DropIn>
            <View style={styles.ringWrap}>
              <View style={StyleSheet.absoluteFill}>
                {limitMinutes ? (
                  <Ring progress={ringProgress} size={RING} stroke={4} color={ringProgress >= 1 ? color.ember : l.color} delay={500} />
                ) : (
                  <View style={[styles.ringStatic, { borderColor: l.color + '55' }]} />
                )}
              </View>
              <Avatar name={current.display_name} avatar={current.avatar} lane={current.lane} size={AVATAR} />
            </View>
          </DropIn>
          <Enter index={1} style={styles.heroText}>
            <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
              {current.display_name}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.laneChip, { backgroundColor: l.color + '24', borderColor: l.color + '55' }]}>
                <View style={[styles.laneDot, { backgroundColor: l.color }]} />
                <Text style={[styles.laneChipText, { color: l.color }]}>
                  {t(laneKey(current.lane))} · {l.ages}
                </Text>
              </View>
              <Text style={styles.joined} numberOfLines={1}>
                {joinedText}
              </Text>
            </View>
          </Enter>
        </Animated.View>

        {/* What the parent dashboard shows, said plainly to the child */}
        {!isAdult && (
          <Enter index={2}>
            <View style={styles.parentSees} accessible accessibilityLabel={`${t('me.parentSees')}. ${t(PARENT_SEES[current.lane])}`}>
              <Icon name="shield" size={18} color={l.color} strokeWidth={2.2} />
              <View style={styles.parentSeesText}>
                <Text style={styles.parentSeesTitle}>{t('me.parentSees')}</Text>
                <Text style={styles.parentSeesBody}>{t(PARENT_SEES[current.lane])}</Text>
              </View>
            </View>
          </Enter>
        )}

        {/* Stats */}
        <Enter index={2} style={styles.stats}>
          <Stat
            value={todayMin}
            format={(n) => t('me.todayValue', { n })}
            label={t('me.stat.today')}
            sub={limitMinutes ? t('me.todayOf', { n: limitMinutes }) : t('me.noLimit')}
            delay={380}
          />
          <View style={styles.statDivider} />
          <Stat value={data?.saved ?? 0} label={t('me.stat.saved')} onPress={() => router.push('/saved')} delay={440} />
          <View style={styles.statDivider} />
          <Stat value={data?.following ?? 0} label={t('me.stat.following')} onPress={() => router.push('/following')} delay={500} />
        </Enter>

        {/* Saved / Taste */}
        <Enter index={3} style={{ gap: space.lg }}>
          <TabSwitch
            value={tab}
            onChange={setTab}
            items={[
              { key: 'saved', label: t('me.stat.saved') },
              { key: 'taste', label: t('me.tab.taste') },
            ]}
          />
          {tab === 'saved' ? (
            saved.loaded && saved.videos.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Icon name="save" size={20} color={color.text2} />
                </View>
                <Text style={styles.emptyText}>{t('feed.saved.emptySub')}</Text>
              </View>
            ) : (
              <View style={{ gap: space.md }}>
                <PosterGrid videos={saved.videos} />
                {(data?.saved ?? 0) > saved.videos.length && (
                  <PressScale
                    onPress={() => {
                      fx.tap();
                      router.push('/saved');
                    }}
                    accessibilityRole="button"
                    style={styles.seeAll}
                  >
                    <Text style={styles.seeAllText}>{t('me.seeAll')}</Text>
                    <Icon name="chevron" size={14} color={color.text} strokeWidth={2.6} />
                  </PressScale>
                )}
              </View>
            )
          ) : (
            <TasteCard taste={data?.taste ?? []} onReset={resetTaste} delay={120} />
          )}
        </Enter>

        {/* Settings */}
        <Enter index={4}>
          <Group title={t('me.group.family')}>
            {!isAdult && (
              <>
                <Row icon="clock" tint={GREEN} label={t('me.dailyLimit')} onPress={openParent}>
                  <Text style={styles.value}>{limitMinutes != null ? t('me.limitValue', { used: todayMin, limit: limitMinutes }) : t('common.off')}</Text>
                  {chevron}
                </Row>
                <Row icon="moon" tint={lanes.teen.color} label={t('me.quietHours')} onPress={openParent} last>
                  <Toggle on={current.quiet_hours} tint={GREEN} />
                </Row>
              </>
            )}
            {isAdult && (
              <Row icon="sliders" tint={lanes.adult.color} label={t('me.familyDashboard')} onPress={openParent} last={!roles.is_creator && !(roles.is_moderator && REVIEW_ENABLED)}>
                {chevron}
              </Row>
            )}
            {isAdult && roles.is_creator && (
              <Row icon="plus" tint={lanes.little.color} label={t('me.creatorStudio')} onPress={() => router.push('/studio')} last={!(roles.is_moderator && REVIEW_ENABLED)}>
                {chevron}
              </Row>
            )}
            {isAdult && roles.is_moderator && REVIEW_ENABLED && (
              <Row icon="shield" tint={GREEN} label={t('me.review')} onPress={() => router.push('/review')} last>
                {waiting > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{waiting}</Text>
                  </View>
                )}
                {chevron}
              </Row>
            )}
          </Group>
        </Enter>

        <Enter index={5}>
          <DeviceGroup />
        </Enter>

        <Enter index={6}>
          <Group title={t('me.group.account')}>
            <Row icon="me" tint={color.text2} label={t('me.switchProfile')} onPress={leaveProfile}>
              {chevron}
            </Row>
            {/* Children reach Sign out through the parent PIN, so they can't sign the family out. */}
            <Row icon="close" tint={color.ember} label={t('me.signOut')} onPress={isAdult ? signOut : openParent} last danger>
              {!isAdult && <Icon name="shield" size={15} color={color.text3} strokeWidth={2.2} />}
              {chevron}
            </Row>
          </Group>
        </Enter>

        <Text style={styles.footer}>{t('me.footer')}</Text>
      </Animated.ScrollView>

      {/* Compact header: fades in once the hero has scrolled away. */}
      <Animated.View style={[styles.compact, { paddingTop: insets.top, height: insets.top + 56 }, compactStyle]} pointerEvents="none">
        <Avatar name={current.display_name} avatar={current.avatar} lane={current.lane} size={28} />
        <Text style={styles.compactName} numberOfLines={1}>
          {current.display_name}
        </Text>
      </Animated.View>

      {/* Top-right: family controls (children) / dashboard (adults). */}
      <View style={[styles.topBar, { top: insets.top + 6 }]}>
        <PressScale onPress={openParent} pressedScale={0.9} accessibilityRole="button" accessibilityLabel={isAdult ? t('me.familyDashboard') : t('me.familyControls')} style={styles.glassButton}>
          <Icon name="sliders" size={19} />
        </PressScale>
      </View>
      <StatusScrim />
    </View>
  );
}

/** Two soft radial glows in the lane colours, drifting slowly, fading into ink. */
function Glow({ tint, second, height }: { tint: string; second: string; height: number }) {
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const a = useSharedValue(0);
  useEffect(() => {
    if (!reduce) a.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, a]);
  const blobA = useAnimatedStyle(() => ({ transform: [{ translateX: -24 + 48 * a.value }, { translateY: 10 * a.value }] }));
  const blobB = useAnimatedStyle(() => ({ transform: [{ translateX: 30 - 60 * a.value }, { translateY: -14 * a.value }] }));
  const size = width * 1.15;
  return (
    <View style={{ width, height }}>
      <Animated.View style={[{ position: 'absolute', left: -size * 0.28, top: -size * 0.22 }, blobA]}>
        <Blob color={tint} size={size} opacity={0.42} id="a" />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', right: -size * 0.42, top: height * 0.08 }, blobB]}>
        <Blob color={second} size={size * 0.9} opacity={0.26} id="b" />
      </Animated.View>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.ink} stopOpacity={0} />
            <Stop offset="0.62" stopColor={color.ink} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color.ink} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#fade)" />
      </Svg>
    </View>
  );
}

function Blob({ color: c, size, opacity, id }: { color: string; size: number; opacity: number; id: string }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={`g${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c} stopOpacity={opacity} />
          <Stop offset="0.55" stopColor={c} stopOpacity={opacity * 0.35} />
          <Stop offset="1" stopColor={c} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill={`url(#g${id})`} />
    </Svg>
  );
}

/** Two tabs with a pill that slides under the active one. */
function TabSwitch<K extends string>({ value, onChange, items }: { value: K; onChange: (k: K) => void; items: { key: K; label: string }[] }) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, items.findIndex((i) => i.key === value));
  const x = useSharedValue(idx);
  useEffect(() => {
    x.value = withSpring(idx, spring.snappy);
  }, [idx, x]);
  const seg = w / items.length;
  const pill = useAnimatedStyle(() => ({ width: seg, transform: [{ translateX: x.value * seg }] }));
  return (
    <View style={styles.tabs} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 8)} accessibilityRole="tablist">
      {w > 0 && <Animated.View style={[styles.tabPill, pill]} />}
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => {
              if (!on) fx.tab();
              onChange(it.key);
            }}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Three-up posters with a soft bottom shade and the view count; a tap opens the feed at that video. */
function PosterGrid({ videos }: { videos: FeedVideo[] }) {
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - space.lg * 2 - GRID_GAP * 2) / 3);
  return (
    <View style={styles.grid}>
      {videos.map((v, i) => (
        <Enter key={v.id} index={i} delay={120} style={{ width: tile }}>
          <PressScale
            onPress={() => {
              fx.tap();
              openVideo(v);
            }}
            pressedScale={0.96}
            accessibilityRole="button"
            accessibilityLabel={v.caption}
            style={[styles.poster, { height: Math.round(tile * 1.4) }]}
          >
            <Image source={v.thumb} cachePolicy="memory-disk" recyclingKey={v.id} style={StyleSheet.absoluteFill} contentFit="cover" />
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
              <Defs>
                <LinearGradient id={`p${i}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0.55" stopColor="#000" stopOpacity={0} />
                  <Stop offset="1" stopColor="#000" stopOpacity={0.65} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width="100%" height="100%" fill={`url(#p${i})`} />
            </Svg>
            <View style={styles.posterMeta}>
              <Icon name="play" size={10} color="#fff" />
              <Text style={styles.posterViews}>{formatCount(v.views)}</Text>
            </View>
          </PressScale>
        </Enter>
      ))}
    </View>
  );
}

/** Sounds, vibration and language for this phone (every profile on it). */
function DeviceGroup() {
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
    <Group title={t('me.group.device')}>
      <Row icon="sound" tint={lanes.little.color} label={t('me.sounds')} onPress={() => flip('sound')}>
        <Toggle on={prefs.sound} tint={GREEN} />
      </Row>
      <Row icon="vibrate" tint={lanes.adult.color} label={t('me.vibration')} onPress={() => flip('haptics')}>
        <Toggle on={prefs.haptics} tint={GREEN} />
      </Row>
      <Row
        icon="discover"
        tint={lanes.teen.color}
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
        <Icon name="chevron" size={15} color={color.text3} strokeWidth={2.4} />
      </Row>
      <BottomSheet open={langOpen} onClose={() => setLangOpen(false)} title={t('common.language')}>
        <View style={{ paddingHorizontal: space.xl }}>
          <LanguagePicker onPicked={() => setLangOpen(false)} />
        </View>
      </BottomSheet>
    </Group>
  );
}

/** The avatar drops in with a little overshoot and a tilt that settles. */
function DropIn({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) p.value = withDelay(60, withSpring(1, spring.bouncy));
  }, [reduce, p]);
  const anim = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 2),
    transform: [{ scale: 0.7 + 0.3 * p.value }, { rotate: `${(1 - p.value) * -10}deg` }],
  }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}

function Stat({ value, label, sub, format = String, onPress, delay }: { value: number; label: string; sub?: string; format?: (n: number) => string; onPress?: () => void; delay: number }) {
  const body = (
    <>
      <CountUp value={value} format={format} delay={delay} style={styles.statValue} />
      <View style={styles.statLabelRow}>
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
        {onPress && <Icon name="chevron" size={11} color={color.text3} strokeWidth={2.6} />}
      </View>
      {/* Every column keeps the third line, so the numbers line up across the card. */}
      <Text style={styles.statSub} numberOfLines={1}>
        {sub ?? ' '}
      </Text>
    </>
  );
  // Equal thirds: PressScale styles its inner view, so the column width lives on this wrapper.
  return (
    <View style={styles.statCol}>
      {onPress ? (
        <PressScale onPress={onPress} pressedScale={0.94} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={styles.stat}>
          {body}
        </PressScale>
      ) : (
        <View style={styles.stat} accessible accessibilityLabel={`${label}: ${format(value)}${sub ? `, ${sub}` : ''}`}>
          {body}
        </View>
      )}
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/** A settings row: rounded-square icon tile, label, value/controls on the right, hairline below. */
function Row({ icon, tint, label, onPress, last, danger, children }: { icon: IconName; tint: string; label: string; onPress: () => void; last?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <PressScale onPress={onPress} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={label} style={styles.row}>
      <View style={[styles.tile, { backgroundColor: tint + '26' }]}>
        <Icon name={icon} size={16} color={tint} strokeWidth={2.4} />
      </View>
      <View style={[styles.rowBody, !last && styles.rowBorder]}>
        <Text style={[styles.rowLabel, danger && { color: color.ember }]} numberOfLines={1}>
          {label}
        </Text>
        {children}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  glowWrap: { position: 'absolute', left: 0, right: 0, top: 0 },
  content: { paddingHorizontal: space.lg, gap: space.xl },

  topBar: { position: 'absolute', right: space.lg, flexDirection: 'row', gap: space.sm },
  glassButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: alpha(color.white, 0.08), borderWidth: 1, borderColor: alpha(color.white, 0.12), alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', gap: space.lg, paddingTop: space.md },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringStatic: { flex: 1, borderRadius: RING / 2, borderWidth: 2 },
  heroText: { alignItems: 'center', gap: space.md, maxWidth: '100%' },
  name: { color: color.text, fontFamily: font.display, fontSize: 34, letterSpacing: -1, textAlign: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap', justifyContent: 'center' },
  laneChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 28, borderRadius: radius.pill, borderWidth: 1 },
  laneDot: { width: 7, height: 7, borderRadius: 4 },
  laneChipText: { fontFamily: font.bold, fontSize: 12, letterSpacing: 0.2 },
  joined: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  parentSees: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: color.surface1 },
  parentSeesText: { flex: 1, gap: 2 },
  parentSeesTitle: { color: color.text, fontFamily: font.semibold, fontSize: 14 },
  parentSeesBody: { color: color.text2, fontFamily: font.medium, fontSize: 13, lineHeight: 18 },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(color.white, 0.05),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.white, 0.14),
    borderRadius: 26,
    paddingVertical: space.md,
  },
  statCol: { flex: 1 },
  stat: { alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 72, paddingHorizontal: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: alpha(color.white, 0.16) },
  statValue: { color: color.text, fontFamily: font.mono, fontSize: 26, letterSpacing: -0.5 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statLabel: { color: color.text2, fontFamily: font.semibold, fontSize: 12, letterSpacing: 0.3 },
  statSub: { color: color.text3, fontFamily: font.medium, fontSize: 12 },

  tabs: { flexDirection: 'row', height: 46, padding: 4, borderRadius: 16, backgroundColor: color.surface1 },
  tabPill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 12, backgroundColor: color.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(color.white, 0.14) },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: color.text3, fontFamily: font.semibold, fontSize: 14 },
  tabTextOn: { color: color.text },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  poster: { borderRadius: 14, overflow: 'hidden', backgroundColor: color.surface1 },
  posterMeta: { position: 'absolute', left: 8, bottom: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  posterViews: { color: color.white, fontFamily: font.bold, fontSize: 12 },
  seeAll: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 4, minHeight: 48, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: color.surface1 },
  seeAllText: { color: color.text, fontFamily: font.semibold, fontSize: 14 },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl, borderRadius: 24, backgroundColor: color.surface1 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: color.text3, fontFamily: font.medium, fontSize: 14, textAlign: 'center', paddingHorizontal: space.xl },

  groupTitle: { color: color.text3, fontFamily: font.bold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: 6 },
  card: { backgroundColor: color.surface1, borderRadius: 22, paddingLeft: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  tile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', paddingRight: 14 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: alpha(color.white, 0.1) },
  rowLabel: { flex: 1, color: color.text, fontFamily: font.semibold, fontSize: 15 },
  value: { color: color.text2, fontFamily: font.medium, fontSize: 14 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: color.ink, fontFamily: font.bold, fontSize: 12 },

  footer: { color: color.text3, fontFamily: font.medium, fontSize: 12, textAlign: 'center', opacity: 0.7 },

  compact: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: alpha(color.ink, 0.94),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(color.white, 0.1),
  },
  compactName: { color: color.text, fontFamily: font.bold, fontSize: 16, maxWidth: 220 },
});
