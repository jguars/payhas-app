import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Icon, IconName } from '@/components/Icon';
import { TAB_BAR, useInsets } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { color, font, radius, space } from '@/theme/tokens';

type ToastSpec = { text: string; icon?: IconName; action?: { label: string; onPress: () => void } };
const Ctx = createContext<(t: ToastSpec) => void>(() => {});

const SHOW_MS = 2600;

/** One toast at a time, floating just above the tab bar. A new toast replaces the old one. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { bottom } = useInsets();
  const [toast, setToast] = useState<(ToastSpec & { id: number }) | null>(null);
  const y = useSharedValue(40);
  const o = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const hide = useCallback(() => {
    y.value = withTiming(30, { duration: 180 });
    o.value = withTiming(0, { duration: 180 });
  }, [y, o]);

  const show = useCallback(
    (t: ToastSpec) => {
      setToast({ ...t, id: ++seq.current });
      // Android reads the live region; VoiceOver needs an explicit announcement.
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t.text);
      y.value = 24;
      y.value = withSpring(0, spring.bouncy);
      o.value = withTiming(1, { duration: 140 });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, SHOW_MS);
    },
    [y, o, hide],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View pointerEvents="box-none" style={[styles.wrap, { bottom: bottom + TAB_BAR.gap + TAB_BAR.height + 12 }, anim]}>
          <View style={styles.toast} accessibilityLiveRegion="polite">
            {toast.icon && <Icon name={toast.icon} size={18} color={color.text} strokeWidth={2.4} />}
            <Text style={styles.text} numberOfLines={2} maxFontSizeMultiplier={1.4}>
              {toast.text}
            </Text>
            {toast.action && (
              <Pressable
                onPress={() => {
                  hide();
                  toast.action?.onPress();
                }}
                hitSlop={10}
                accessibilityRole="button"
              >
                <Text style={styles.action}>{toast.action.label}</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: TAB_BAR.side, right: TAB_BAR.side, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: '100%',
    paddingHorizontal: 16,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: color.text,
    elevation: 10,
    shadowColor: color.black,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  text: { color: color.ink, fontFamily: font.semibold, fontSize: 14, flexShrink: 1 },
  action: { color: color.ember, fontFamily: font.bold, fontSize: 14, marginLeft: space.xs },
});
