import { usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { forwardRef, useEffect, useState } from 'react';
import { Pressable, PressableProps, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, ZoomIn } from 'react-native-reanimated';

import { Icon, IconName } from '@/components/Icon';
import { Pop } from '@/components/motion/Pop';
import { useLibrary } from '@/features/library/LibraryProvider';
import { fx } from '@/lib/feedback';
import { TAB_BAR, useInsets } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { color, radius } from '@/theme/tokens';

const ROUTES = ['/', '/discover', '/play', '/inbox', '/me'];
const PLAY_INDEX = 2;
const PILL_W = 52;
const PILL_H = 40;

type TabButtonProps = PressableProps & { icon: IconName; label: string; isFocused?: boolean; primary?: boolean; badge?: boolean };

const TabButton = forwardRef<View, TabButtonProps>(({ icon, label, isFocused, primary, badge, ...rest }, ref) => (
  // `rest` last except style: TabTrigger passes its own style, which would undo the equal-width slots.
  <Pressable ref={ref} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: !!isFocused }} {...rest} onPressIn={() => !isFocused && fx.tab()} style={styles.tab}>
    {primary ? (
      <Pop on={isFocused ?? false} peak={1.1}>
        <View style={styles.play}>
          <Icon name={icon} size={24} color={color.ink} strokeWidth={2.2} />
        </View>
      </Pop>
    ) : (
      <Pop on={isFocused ?? false} peak={1.14}>
        <Icon name={icon} size={24} color={isFocused ? color.text : color.text3} filled={isFocused} strokeWidth={isFocused ? 2.2 : 2} />
        {badge && <Animated.View entering={ZoomIn.springify().damping(spring.bouncy.damping)} style={styles.badge} />}
      </Pop>
    )}
  </Pressable>
));

// TabTrigger clones props (isFocused, onPress…) onto its child, so pass them through.
const InboxTabButton = forwardRef<View, PressableProps & { isFocused?: boolean }>((props, ref) => {
  const { unread } = useLibrary();
  return <TabButton ref={ref} icon="inbox" label={unread ? `Inbox, ${unread} new` : 'Inbox'} badge={unread > 0} {...props} />;
});

/** The soft pill behind the active icon. Slides between tabs; steps aside for Play, which has its own. */
function Highlight({ width }: { width: number }) {
  const pathname = usePathname();
  const index = Math.max(0, ROUTES.indexOf(pathname));
  const slot = width / ROUTES.length;
  const x = useSharedValue(index);
  const shown = useSharedValue(index === PLAY_INDEX ? 0 : 1);

  useEffect(() => {
    x.value = withSpring(index, spring.smooth);
    shown.value = withSpring(index === PLAY_INDEX ? 0 : 1, spring.snappy);
  }, [index, x, shown]);

  const anim = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: x.value * slot + (slot - PILL_W) / 2 }, { scale: 0.7 + 0.3 * shown.value }],
  }));
  if (width === 0) return null;
  return <Animated.View pointerEvents="none" style={[styles.highlight, anim]} />;
}

export default function TabsLayout() {
  const { bottom } = useInsets();
  const [width, setWidth] = useState(0);

  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.root} />
      {/* Floats above the gesture bar; screens add useTabBarSpace() so content clears it. */}
      <TabList style={[styles.bar, { bottom: bottom + TAB_BAR.gap }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Highlight width={width} />
        <TabTrigger name="index" href="/" asChild>
          <TabButton icon="home" label="Home" />
        </TabTrigger>
        <TabTrigger name="discover" href="/discover" asChild>
          <TabButton icon="discover" label="Discover" />
        </TabTrigger>
        <TabTrigger name="play" href="/play" asChild>
          <TabButton icon="game" label="Play" primary />
        </TabTrigger>
        <TabTrigger name="inbox" href="/inbox" asChild>
          <InboxTabButton />
        </TabTrigger>
        <TabTrigger name="me" href="/me" asChild>
          <TabButton icon="me" label="Me" />
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
    backgroundColor: 'rgba(20,20,27,0.94)',
    borderWidth: 1,
    borderColor: color.line,
    flexDirection: 'row',
    alignItems: 'center',
    // Lift it off whatever is behind (video, cards): soft shadow on both platforms.
    elevation: 14,
    shadowColor: '#000',
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
    borderRadius: radius.chip + 2,
    backgroundColor: color.surface2,
  },
  play: { width: 52, height: 40, borderRadius: radius.chip + 2, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -1, right: -3, width: 9, height: 9, borderRadius: 5, backgroundColor: color.ember, borderWidth: 2, borderColor: color.surface1 },
});
