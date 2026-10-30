import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { media } from '@/theme/tokens';

/**
 * A dark fade over pictures so white text on them stays readable: from
 * `strength` at the bottom edge to clear at the top. Drawn with SVG, so it
 * looks the same on iOS, Android and web (CSS gradients don't render on web).
 */
export function MediaFade({ strength = 0.9 }: { strength?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} aria-hidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`f${id}`} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={media.scrim} stopOpacity={strength} />
            <Stop offset="0.45" stopColor={media.scrim} stopOpacity={strength * 0.7} />
            <Stop offset="1" stopColor={media.scrim} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#f${id})`} />
      </Svg>
    </View>
  );
}
