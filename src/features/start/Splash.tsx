import { Text, View } from 'react-native';

import { Enter } from '@/components/motion/Enter';
import { color, font, pageFill, space, themedStyles, type } from '@/theme/tokens';

import { LaneMark } from './LaneMark';

/** Shown while the app gets ready: the lane mark over the wordmark, nothing else. */
export function Splash() {
  return (
    <View style={styles.root} accessibilityLabel="Payhas">
      <Enter index={0} style={styles.center}>
        <LaneMark />
        <Text style={styles.word}>payhas</Text>
      </Enter>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill(), alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: space.lg },
  word: { color: color.text, fontFamily: font.display, ...type.hero },
}));
