import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { forwardRef } from 'react';
import { Pressable, PressableProps, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '@/components/Icon';
import { color, radius, tabBarHeight } from '@/theme/tokens';

type TabButtonProps = PressableProps & { icon: IconName; label: string; isFocused?: boolean; primary?: boolean };

const TabButton = forwardRef<View, TabButtonProps>(({ icon, label, isFocused, primary, ...rest }, ref) => (
  <Pressable ref={ref} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: !!isFocused }} hitSlop={6} style={styles.tab} {...rest}>
    {primary ? (
      <View style={styles.create}>
        <Icon name="plus" size={22} color={color.ink} strokeWidth={2.6} />
      </View>
    ) : (
      <Icon name={icon} size={26} color={isFocused ? color.text : color.text3} filled={isFocused} />
    )}
  </Pressable>
));

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.root} />
      <TabList style={[styles.bar, { height: tabBarHeight + insets.bottom, paddingBottom: insets.bottom }]}>
        <TabTrigger name="index" href="/" asChild>
          <TabButton icon="home" label="Home" />
        </TabTrigger>
        <TabTrigger name="discover" href="/discover" asChild>
          <TabButton icon="discover" label="Discover" />
        </TabTrigger>
        <TabTrigger name="create" href="/create" asChild>
          <TabButton icon="plus" label="Create" primary />
        </TabTrigger>
        <TabTrigger name="inbox" href="/inbox" asChild>
          <TabButton icon="inbox" label="Inbox" />
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
    backgroundColor: color.ink,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tab: { width: 56, height: 44, alignItems: 'center', justifyContent: 'center' },
  create: {
    width: 52,
    height: 36,
    borderRadius: radius.chip,
    backgroundColor: color.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
