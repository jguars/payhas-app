import { View } from 'react-native';

import { lane as lanes, radius, space, themedStyles } from '@/theme/tokens';

const LANES = ['little', 'kids', 'teen', 'adult'] as const;

/** The four lane colours side by side — Payhas's mark on the splash and the first-run screens. */
export function LaneMark() {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {LANES.map((l) => (
        <View key={l} style={[styles.bar, { backgroundColor: lanes[l].color }]} />
      ))}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', gap: space.sm },
  bar: { width: space.xl, height: space.sm, borderRadius: radius.pill },
}));
