import { NavigationBar } from 'expo-navigation-bar';
import { usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { forwardRef, useEffect, useState } from 'react';
import { Pressable, PressableProps, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { NavIcon, NavKind } from '@/components/ui/NavIcon';
import { useFamily } from '@/features/family/FamilyProvider';
import { useLibrary } from '@/features/library/LibraryProvider';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { TabBarToneProvider, useTabBarOnVideo } from '@/lib/tabBarTone';
import { TAB_BAR, TAB_ROUTES, tabIndex, useInsets } from '@/lib/useInsets';
import { duration, spring, tabStretch } from '@/theme/motion';
import { border, color, font, media, pageFill, radius, space, themedStyles, type } from '@/theme/tokens';

const PILL = TAB_BAR.pill;
/** Icon pill + gap + label, centred in the bar. */
const PILL_TOP = (TAB_BAR.height - PILL.height - space.xs - type.caption.lineHeight) / 2;

/** The bar is dark only on Home while a video is on screen. */
const useOnMedia = () => {
  const onVideo = useTabBarOnVideo();
  return usePathname() === '/' && onVideo;
};

type TabButtonProps = PressableProps & { kind: NavKind; label: string; a11yLabel?: string; isFocused?: boolean; badge?: boolean };

const TabButton = forwardRef<View, TabButtonProps>(({ kind, label, a11yLabel, isFocused, badge, onPress, ...rest }, ref) => {
  const onMedia = useOnMedia();
  // On the selected pill the dot gets a ring in the pill's ink so it stays 3:1 against it.
  const ring = isFocused ? (onMedia ? media.scrim : color.onInverse) : onMedia ? media.scrim : color.surface1;
  return (
    // `rest` first: TabTrigger passes its own style and state, which would undo the equal-width slots and the selected state.
    <Pressable
      ref={ref}
      {...rest}
      testID={`tab-${kind}`}
      accessibilityRole="tab"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ selected: !!isFocused }}
      aria-selected={!!isFocused}
      onPress={(e) => {
        if (!isFocused) fx.tab();
        onPress?.(e);
      }}
      style={styles.tab}
    >
      <View style={styles.icon}>
        <NavIcon kind={kind} active={!!isFocused} onMedia={onMedia} />
        {/* A calm dot: no bounce, nothing that begs to be checked. */}
        {badge && <View style={[styles.badge, { borderColor: ring }]} />}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        maxFontSizeMultiplier={1.3}
        style={[styles.label, isFocused && styles.labelOn, onMedia && { color: isFocused ? media.text : media.text3 }]}
      >
        {label}
      </Text>
    </Pressable>
  );
});
TabButton.displayName = 'TabButton';

// TabTrigger clones props (isFocused, onPress…) onto its child, so pass them through.
const InboxTabButton = forwardRef<View, PressableProps & { isFocused?: boolean }>((props, ref) => {
  const { unread } = useLibrary();
  const { current } = useFamily();
  const { t } = useT();
  // Little ones (0–6) get no unread dot: their inbox is grown-up notices, not something to check.
  const badge = unread > 0 && current?.lane !== 'little';
  return <TabButton ref={ref} kind="inbox" label={t('nav.inbox')} a11yLabel={unread ? t('nav.inboxUnread', { count: unread }) : undefined} badge={badge} {...props} />;
});
InboxTabButton.displayName = 'InboxTabButton';

/**
 * The pill behind the active tab's icon. It slides on a spring and stretches a
 * little while it travels (then settles). It is the one selected style
 * (inverse), the same on every tab — colour is not decoration. Off the tabs
 * (a nested route) there is no pill.
 */
function Highlight({ width }: { width: number }) {
  const index = tabIndex(usePathname());
  const onMedia = useOnMedia();
  const reduce = useReducedMotion();
  const slot = width / TAB_ROUTES.length;
  const x = useSharedValue(Math.max(0, index));
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);

  useEffect(() => {
    if (index < 0) return;
    if (reduce) {
      x.value = index;
      return;
    }
    const far = Math.abs(x.value - index);
    x.value = withSpring(index, spring.tabPill);
    if (far > 0.01) {
      sx.value = withSequence(withTiming(1 + Math.min(tabStretch.max, tabStretch.perTab * far), { duration: duration.fast }), withSpring(1, spring.smooth));
      sy.value = withSequence(withTiming(tabStretch.squash, { duration: duration.fast }), withSpring(1, spring.smooth));
    }
  }, [index, reduce, x, sx, sy]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * slot + (slot - PILL.width) / 2 }, { scaleX: sx.value }, { scaleY: sy.value }],
  }));
  if (width === 0 || index < 0) return null;
  return <Animated.View pointerEvents="none" style={[styles.highlight, onMedia && { backgroundColor: media.text }, anim]} />;
}

/** Tabs must see TabList/TabTrigger as its own children, so the bar is written inline here. */
function TabsWithBar() {
  const { bottom } = useInsets();
  const [width, setWidth] = useState(0);
  const { t } = useT();
  const onMedia = useOnMedia();
  const reduce = useReducedMotion();
  // Cross-fade between the page bar and the dark bar over video, instead of a one-frame flip.
  const m = useSharedValue(onMedia ? 1 : 0);
  useEffect(() => {
    m.value = reduce ? (onMedia ? 1 : 0) : withTiming(onMedia ? 1 : 0, { duration: duration.fast });
  }, [onMedia, reduce, m]);
  const page = { bg: color.surface1, line: color.line };
  const tone = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(m.value, [0, 1], [page.bg, media.scrim]),
    borderTopColor: interpolateColor(m.value, [0, 1], [page.line, media.scrim]),
  }));

  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />
      {/* Android 3-button nav: its buttons follow the bar under them. */}
      <NavigationBar style={onMedia || color.scheme !== 'light' ? 'light' : 'dark'} />
      {/* Docked under the screens (not over them): content never slides behind it. */}
      <TabList
        accessibilityRole="tablist"
        style={[styles.bar, { height: TAB_BAR.height + bottom, paddingBottom: bottom }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View pointerEvents="none" style={[styles.fill, tone]} />
        <Highlight width={width} />
        <TabTrigger name="index" href="/" asChild>
          <TabButton kind="home" label={t('nav.home')} />
        </TabTrigger>
        <TabTrigger name="discover" href="/discover" asChild>
          <TabButton kind="discover" label={t('nav.discover')} />
        </TabTrigger>
        <TabTrigger name="play" href="/play" asChild>
          <TabButton kind="play" label={t('nav.play')} />
        </TabTrigger>
        <TabTrigger name="inbox" href="/inbox" asChild>
          <InboxTabButton />
        </TabTrigger>
        <TabTrigger name="me" href="/me" asChild>
          <TabButton kind="me" label={t('nav.me')} />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <TabBarToneProvider>
      <TabsWithBar />
    </TabBarToneProvider>
  );
}

const BADGE = space.sm + border.strong;

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  slot: { flex: 1 },
  bar: { flexDirection: 'row' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderTopWidth: border.hairline },
  tab: { flex: 1, height: TAB_BAR.height, alignItems: 'center', paddingTop: PILL_TOP, gap: space.xs },
  icon: { width: PILL.width, height: PILL.height, alignItems: 'center', justifyContent: 'center' },
  label: { ...type.caption, fontFamily: font.semibold, color: color.text3, paddingHorizontal: space.xs },
  labelOn: { color: color.text },
  highlight: {
    position: 'absolute',
    left: 0,
    top: PILL_TOP,
    width: PILL.width,
    height: PILL.height,
    borderRadius: radius.pill,
    backgroundColor: color.inverse,
  },
  badge: {
    position: 'absolute',
    top: space.xs,
    right: space.md,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: color.ember,
    borderWidth: border.strong,
  },
}));
