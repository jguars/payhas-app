import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Icon, IconName } from '@/components/Icon';
import { TAB_BAR, useInsets } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { color, control, elevation, font, iconSize, iconStroke, radius, size, space, themedStyles } from '@/theme/tokens';

/**
 * `action` adds one button (Undo). `onDismiss` runs when the toast goes away
 * without its action being pressed — timed out or replaced — so a caller can
 * commit something only once the Undo window has passed.
 */
type ToastSpec = { text: string; icon?: IconName; action?: { label: string; onPress: () => void }; onDismiss?: () => void };
const Ctx = createContext<(t: ToastSpec) => void>(() => {});

const SHOW_MS = 2600;
/** With an action (Undo) the toast waits long enough to reach it, also with a screen reader (WCAG 2.2.1). */
const ACTION_MS = 7000;
/** With a screen reader on, an action toast stays much longer: finding the button takes time. */
const ACTION_SR_MS = 30000;

/** One toast at a time, floating just above the tab bar. A new toast replaces the old one. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { bottom } = useInsets();
  const [toast, setToast] = useState<(ToastSpec & { id: number }) | null>(null);
  const y = useSharedValue(40);
  const o = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const pending = useRef<(() => void) | undefined>(undefined);
  const screenReader = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then((on) => (screenReader.current = on));
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (on) => (screenReader.current = on));
    return () => sub.remove();
  }, []);

  const hide = useCallback(() => {
    y.value = withTiming(30, { duration: 180 });
    o.value = withTiming(0, { duration: 180 });
  }, [y, o]);

  /** Hide, and run the pending onDismiss (the action wasn't taken). */
  const dismiss = useCallback(() => {
    const done = pending.current;
    pending.current = undefined;
    hide();
    done?.();
  }, [hide]);

  const show = useCallback(
    (t: ToastSpec) => {
      // A new toast replaces the old one: the old one counts as dismissed.
      const prev = pending.current;
      pending.current = t.onDismiss;
      prev?.();
      setToast({ ...t, id: ++seq.current });
      // Android reads the live region; VoiceOver needs an explicit announcement.
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t.text);
      y.value = 24;
      y.value = withSpring(0, spring.bouncy);
      o.value = withTiming(1, { duration: 140 });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(dismiss, t.action ? (screenReader.current ? ACTION_SR_MS : ACTION_MS) : SHOW_MS);
    },
    [y, o, dismiss],
  );

  // Leaving the app's tree (sign-out, theme remount) commits whatever is waiting.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      pending.current?.();
    },
    [],
  );

  const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View pointerEvents="box-none" style={[styles.wrap, { bottom: bottom + TAB_BAR.gap + TAB_BAR.height + 12 }, anim]}>
          <View style={styles.toast} accessibilityLiveRegion="polite">
            {toast.icon && <Icon name={toast.icon} size={iconSize.md} color={color.onInverse} strokeWidth={iconStroke(iconSize.md)} />}
            <Text style={styles.text} numberOfLines={2} maxFontSizeMultiplier={1.4}>
              {toast.text}
            </Text>
            {toast.action && (
              <Pressable
                onPress={() => {
                  pending.current = undefined;
                  if (timer.current) clearTimeout(timer.current);
                  hide();
                  toast.action?.onPress();
                }}
                hitSlop={space.md}
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

const styles = themedStyles(() => ({
  wrap: { position: 'absolute', left: TAB_BAR.side, right: TAB_BAR.side, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: '100%',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    minHeight: control.md,
    borderRadius: radius.lg,
    backgroundColor: color.inverse,
    ...elevation.float,
  },
  text: { color: color.onInverse, fontFamily: font.semibold, fontSize: size.small, flexShrink: 1 },
  // On the inverse surface ember fails contrast in every theme; the action is the toast's own colour, bold and underlined.
  action: { color: color.onInverse, fontFamily: font.bold, fontSize: size.small, marginLeft: space.xs, textDecorationLine: 'underline' },
}));
