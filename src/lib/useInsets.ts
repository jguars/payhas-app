import { Platform, StatusBar } from 'react-native';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';

/** Gesture-bar height on Android when the reported inset is missing (16dp is the platform norm). */
const ANDROID_GESTURE_FALLBACK = 16;

/**
 * Safe-area insets with an Android floor. On the Xiaomi 13 the reported values
 * are right (top 37.8dp, bottom 16dp); the floor only guards devices that
 * report 0 before the first insets pass.
 */
export function useInsets(): EdgeInsets {
  const i = useSafeAreaInsets();
  if (Platform.OS !== 'android') return i;
  return {
    ...i,
    top: Math.max(i.top, StatusBar.currentHeight ?? 0),
    bottom: Math.max(i.bottom, ANDROID_GESTURE_FALLBACK),
  };
}

/** Floating tab bar geometry, shared by the bar and by screens that must clear it. */
export const TAB_BAR = { height: 64, gap: 10, side: 16 } as const;

/** Bottom padding a tab screen needs so its last item scrolls clear of the floating bar. */
export function useTabBarSpace() {
  const { bottom } = useInsets();
  return bottom + TAB_BAR.gap + TAB_BAR.height + 16;
}
