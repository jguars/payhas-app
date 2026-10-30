import { View } from 'react-native';

import { color, radius, themedStyles } from '@/theme/tokens';

/**
 * Time used or progress: success green, danger once it's full. `remaining`
 * flips it to time left (shrinking), warning in the last 15 %. `thin` for
 * inside rows. `label` names it for screen readers.
 */
export function ProgressBar({ progress, label, thin, remaining }: { progress: number; label: string; thin?: boolean; remaining?: boolean }) {
  const p = Math.max(0, Math.min(1, progress));
  const h = thin ? 6 : 8;
  return (
    <View style={[styles.track, { height: h }]} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}>
      <View style={[styles.fill, { width: `${Math.max(p > 0 ? 3 : 0, p * 100)}%`, backgroundColor: remaining ? (p <= 0.15 ? color.warning : color.success) : p >= 1 ? color.danger : color.success }]} />
    </View>
  );
}

const styles = themedStyles(() => ({
  track: { borderRadius: radius.pill, backgroundColor: color.surface2, overflow: 'hidden', alignSelf: 'stretch' },
  fill: { height: '100%', borderRadius: radius.pill },
}));
