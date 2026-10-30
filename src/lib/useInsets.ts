import { Platform, StatusBar } from 'react-native';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/theme/tokens';

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

/**
 * Docked tab bar geometry, shared by the bar and by things that sit above it.
 * `height` is the bar without the gesture-bar inset; `pill` is the selected
 * highlight behind the icon.
 */
export const TAB_BAR = { height: 64, pill: { width: 56, height: 32 } } as const;

/**
 * Bottom padding a tab screen's scroll content needs. The bar is docked (in
 * the layout, not over it), so this is only breathing room after the last item.
 */
export function useTabBarSpace() {
  return space.lg;
}
