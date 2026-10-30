import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { control, media, space } from '@/theme/tokens';

/** How dark the scrims get at their densest; tuned so white icons and text stay readable on a white frame. */
const BOTTOM = 0.75;
const GLOW = 0.72;
const TOP = 0.72;
/** The bottom fade reaches this far up the video. */
const BOTTOM_HEIGHT = control.lg * 6;
/** The glow behind the right rail: centred on the upper actions, tall enough to fade out before its top edge. */
const GLOW_W = control.lg * 3;
const GLOW_H = (control.md + space.xs) * 5 + control.md * 5;

/**
 * The darkening under the feed's text and icons: a fade from the bottom and a
 * soft glow behind the right rail. Drawn with SVG so it looks the same on iOS,
 * Android and web (CSS gradients don't render on web), and never takes touches.
 */
export function FeedScrims({ railBottom }: { railBottom: number }) {
  // Every video mounts its own copy: gradient ids must be unique on web, where they share one document.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} aria-hidden importantForAccessibility="no-hide-descendants">
      <Svg style={[styles.bottom, { height: BOTTOM_HEIGHT }]} width="100%" height={BOTTOM_HEIGHT}>
        <Defs>
          <LinearGradient id={`b${id}`} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={media.scrim} stopOpacity={BOTTOM} />
            <Stop offset="0.45" stopColor={media.scrim} stopOpacity={BOTTOM * 0.55} />
            <Stop offset="1" stopColor={media.scrim} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#b${id})`} />
      </Svg>
      <Svg style={[styles.glow, { bottom: railBottom - control.md }]} width={GLOW_W} height={GLOW_H}>
        <Defs>
          <RadialGradient id={`r${id}`} cx="100%" cy="55%" rx="100%" ry="55%" fx="100%" fy="55%">
            <Stop offset="0" stopColor={media.scrim} stopOpacity={GLOW} />
            <Stop offset="0.45" stopColor={media.scrim} stopOpacity={GLOW * 0.85} />
            <Stop offset="0.75" stopColor={media.scrim} stopOpacity={GLOW * 0.4} />
            <Stop offset="1" stopColor={media.scrim} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#r${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  glow: { position: 'absolute', right: 0, width: GLOW_W, height: GLOW_H },
});

/** The fade under Home's top bar (lane badge, Following / For you, search). */
export function TopScrim() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" aria-hidden>
      <Defs>
        <LinearGradient id={`t${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={media.scrim} stopOpacity={TOP} />
          <Stop offset="0.6" stopColor={media.scrim} stopOpacity={TOP * 0.85} />
          <Stop offset="1" stopColor={media.scrim} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#t${id})`} />
    </Svg>
  );
}
