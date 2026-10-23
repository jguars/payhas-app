import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { LanguagePicker } from '@/components/LanguagePicker';
import { Enter } from '@/components/motion/Enter';
import { useInsets } from '@/lib/useInsets';
import { color, font, lane as lanes, space } from '@/theme/tokens';

/**
 * The very first screen on a new phone, before sign-in: the language, asked
 * in all four at once. Picking one moves on by itself (the router watches it).
 */
export default function LanguageScreen() {
  const insets = useInsets();
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + space.xl }]}>
      <Enter index={0}>
        <View style={styles.lanesRow}>
          {(['little', 'kids', 'teen', 'adult'] as const).map((l) => (
            <View key={l} style={[styles.laneBar, { backgroundColor: lanes[l].color }]} />
          ))}
        </View>
      </Enter>
      <Enter index={1}>
        <Text style={styles.brand}>Payhas</Text>
      </Enter>
      <Enter index={2}>
        <Text style={styles.ask}>Dili saýlaň · Dil seçin · Выберите язык · Choose a language</Text>
      </Enter>
      <View style={{ marginTop: space.xl }}>
        <LanguagePicker firstRun />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  content: { paddingHorizontal: space.xl, gap: space.md },
  lanesRow: { flexDirection: 'row', gap: 6, marginBottom: space.md },
  laneBar: { width: 36, height: 10, borderRadius: 5 },
  brand: { color: color.text, fontFamily: font.display, fontSize: 44, letterSpacing: -1.2 },
  ask: { color: color.text2, fontFamily: font.medium, fontSize: 15, lineHeight: 22 },
});
