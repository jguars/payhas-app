import { usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { forwardRef, useEffect, useState } from 'react';
import { Pressable, PressableProps, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { NavIcon, NavKind } from '@/components/ui/NavIcon';
import { useLibrary } from '@/features/library/LibraryProvider';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { TAB_BAR, useInsets } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { border, color, font, media, pageFill, radius, space, themedStyles, type } from '@/theme/tokens';

const ROUTES = ['/', '/discover', '/play', '/inbox', '/me'];
const PILL = TAB_BAR.pill;
/** Icon pill + label, centred in the bar. */
const PILL_TOP = (TAB_BAR.height - PILL.height - space.xs / 2 - type.caption.lineHeight) / 2;

type TabButtonProps = PressableProps & { kind: NavKind; label: string; a11yLabel?: string; isFocused?: boolean; badge?: boolean };

/** Home plays video edge to edge: there the bar is dark in every theme. */
const useOnMedia = () => usePathname() === '/';

const TabButton = forwardRef<View, TabButtonProps>(({ kind, label, a11yLabel, isFocused, badge, ...rest }, ref) => {
  const onMedia = useOnMedia();
  return (
    // `rest` first: TabTrigger passes its own style and state, which would undo the equal-width slots and the selected state.
    <Pressable
      ref={ref}
      {...rest}
      accessibilityRole="tab"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ selected: !!isFocused }}
      aria-selected={!!isFocused}
      onPressIn={() => !isFocused && fx.tab()}
      style={styles.tab}
    >
      <View style={styles.icon}>
        <NavIcon kind={kind} active={!!isFocused} onMedia={onMedia} />
        {badge && (
          <Animated.View
            entering={ZoomIn.springify().damping(spring.bouncy.damping)}
            style={[styles.badge, { borderColor: isFocused ? (onMedia ? media.text : color.inverse) : onMedia ? media.scrim : color.surface1 }]}
          />
        )}
      </View>
      <Text
        numberOfLines={1}
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
  const { t } = useT();
  return <TabButton ref={ref} kind="inbox" label={t('nav.inbox')} a11yLabel={unread ? t('nav.inboxUnread', { count: unread }) : undefined} badge={unread > 0} {...props} />;
});
InboxTabButton.displayName = 'InboxTabButton';

/**
 * The pill behind the active tab's icon. It slides on a spring, stretches like
 * jelly while it travels (then snaps back with a little squash). It is the one
 * selected style (inverse), the same on every tab — colour is not decoration.
 */
function Highlight({ width }: { width: number }) {
  const pathname = usePathname();
  const onMedia = pathname === '/';
  const reduce = useReducedMotion();
  const index = Math.max(0, ROUTES.indexOf(pathname));
  const slot = width / ROUTES.length;
  const x = useSharedValue(index);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      x.value = index;
      return;
    }
    const far = Math.abs(x.value - index);
    x.value = withSpring(index, { damping: 16, stiffness: 170, mass: 0.9 });
    if (far > 0.01) {
      sx.value = withSequence(withTiming(1 + Math.min(0.55, 0.22 * far), { duration: 120 }), withSpring(1, spring.bouncy));
      sy.value = withSequence(withTiming(0.82, { duration: 120 }), withSpring(1, spring.bouncy));
    }
  }, [index, reduce, x, sx, sy]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * slot + (slot - PILL.width) / 2 }, { scaleX: sx.value }, { scaleY: sy.value }],
  }));
  if (width === 0) return null;
  return <Animated.View pointerEvents="none" style={[styles.highlight, onMedia && { backgroundColor: media.text }, anim]} />;
}

export default function TabsLayout() {
  const { bottom } = useInsets();
  const [width, setWidth] = useState(0);
  const { t } = useT();
  const onMedia = useOnMedia();

  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />
      {/* Docked under the screens (not over them): content never slides behind it. */}
      <TabList
        accessibilityRole="tablist"
        style={[styles.bar, { height: TAB_BAR.height + bottom, paddingBottom: bottom }, onMedia && styles.barMedia]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
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

const BADGE = space.sm + border.strong;

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  slot: { flex: 1 },
  bar: {
    flexDirection: 'row',
    backgroundColor: color.surface1,
    borderTopWidth: border.hairline,
    borderTopColor: color.line,
  },
  barMedia: { backgroundColor: media.scrim, borderTopColor: media.line },
  tab: { flex: 1, height: TAB_BAR.height, alignItems: 'center', paddingTop: PILL_TOP, gap: space.xs / 2 },
  icon: { width: PILL.width, height: PILL.height, alignItems: 'center', justifyContent: 'center' },
  label: { ...type.caption, fontFamily: font.semibold, color: color.text3, paddingHorizontal: space.xs / 2 },
  labelOn: { fontFamily: font.bold, color: color.text },
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
    top: space.xs / 2,
    right: space.md,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: color.ember,
    borderWidth: border.strong,
  },
}));
