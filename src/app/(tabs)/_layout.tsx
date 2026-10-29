import { usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { forwardRef, useEffect, useState } from 'react';
import { Pressable, PressableProps, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
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
import { alpha, color, lane } from '@/theme/tokens';

const ROUTES = ['/', '/discover', '/play', '/inbox', '/me'];
/** Each tab owns a colour from the palette; the pill blends between them as it slides. */
const TAB_COLORS = [color.ember, lane.teen.color, lane.kids.color, lane.little.color, lane.adult.color];
const PILL_W = 54;
const PILL_H = 42;

type TabButtonProps = PressableProps & { kind: NavKind; label: string; isFocused?: boolean; badge?: boolean };

const TabButton = forwardRef<View, TabButtonProps>(({ kind, label, isFocused, badge, ...rest }, ref) => (
  // `rest` last except style: TabTrigger passes its own style, which would undo the equal-width slots.
  <Pressable ref={ref} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: !!isFocused }} {...rest} onPressIn={() => !isFocused && fx.tab()} style={styles.tab}>
    <View>
      <NavIcon kind={kind} active={!!isFocused} />
      {badge && <Animated.View entering={ZoomIn.springify().damping(spring.bouncy.damping)} style={[styles.badge, isFocused && { borderColor: TAB_COLORS[3] }]} />}
    </View>
  </Pressable>
));
TabButton.displayName = 'TabButton';

// TabTrigger clones props (isFocused, onPress…) onto its child, so pass them through.
const InboxTabButton = forwardRef<View, PressableProps & { isFocused?: boolean }>((props, ref) => {
  const { unread } = useLibrary();
  const { t } = useT();
  return <TabButton ref={ref} kind="inbox" label={unread ? t('nav.inboxUnread', { count: unread }) : t('nav.inbox')} badge={unread > 0} {...props} />;
});
InboxTabButton.displayName = 'InboxTabButton';

/**
 * The pill behind the active tab. It slides on a spring, stretches like jelly
 * while it travels (then snaps back with a little squash), and its colour
 * blends from the old tab's to the new one's on the way.
 */
function Highlight({ width }: { width: number }) {
  const pathname = usePathname();
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
    backgroundColor: interpolateColor(x.value, [0, 1, 2, 3, 4], TAB_COLORS),
    transform: [{ translateX: x.value * slot + (slot - PILL_W) / 2 }, { scaleX: sx.value }, { scaleY: sy.value }],
  }));
  if (width === 0) return null;
  return <Animated.View pointerEvents="none" style={[styles.highlight, anim]} />;
}

export default function TabsLayout() {
  const { bottom } = useInsets();
  const [width, setWidth] = useState(0);
  const { t } = useT();

  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.root} />
      {/* Floats above the gesture bar; screens add useTabBarSpace() so content clears it. */}
      <TabList style={[styles.bar, { bottom: bottom + TAB_BAR.gap }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  bar: {
    position: 'absolute',
    left: TAB_BAR.side,
    right: TAB_BAR.side,
    height: TAB_BAR.height,
    borderRadius: TAB_BAR.height / 2,
    backgroundColor: alpha(color.surface1, 0.94),
    borderWidth: 1,
    borderColor: color.line,
    flexDirection: 'row',
    alignItems: 'center',
    // Lift it off whatever is behind (video, cards): soft shadow on both platforms.
    elevation: 14,
    shadowColor: color.black,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  highlight: {
    position: 'absolute',
    left: 0,
    top: (TAB_BAR.height - 2 - PILL_H) / 2,
    width: PILL_W,
    height: PILL_H,
    borderRadius: 16,
  },
  badge: { position: 'absolute', top: -2, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: color.ember, borderWidth: 2, borderColor: color.surface1 },
});
