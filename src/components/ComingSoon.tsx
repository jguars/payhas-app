import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, font } from '@/theme/tokens';

export function ComingSoon({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink, paddingHorizontal: 16 },
  title: { color: color.text, fontFamily: font.display, fontSize: 30, letterSpacing: -0.9 },
});
