import { StyleSheet, View } from 'react-native';

import { useInsets } from '@/lib/useInsets';
import { color } from '@/theme/tokens';

/**
 * A fade behind the transparent status bar, so scrolled content dissolves
 * under the clock instead of colliding with it. Place last in a scrolling screen.
 */
export function StatusScrim() {
  const { top } = useInsets();
  return <View pointerEvents="none" style={[styles.scrim, { height: top + 18 }]} />;
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    experimental_backgroundImage: `linear-gradient(180deg, ${color.ink} 0%, ${color.ink} 62%, rgba(10,10,15,0) 100%)`,
  },
});
