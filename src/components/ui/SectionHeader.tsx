import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { color, font, space } from '@/theme/tokens';

/** Shelf / section title with an optional quiet "See all ›" (after Hulu and Epidemic Sound). */
export function SectionHeader({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {!!action && (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" style={styles.action}>
          <Text style={styles.actionText}>{action}</Text>
          <Icon name="chevron" size={14} color={color.text2} strokeWidth={2.6} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  title: { color: color.text, fontFamily: font.title, fontSize: 20, letterSpacing: -0.3 },
  subtitle: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, minHeight: 48, minWidth: 48 },
  actionText: { color: color.text2, fontFamily: font.semibold, fontSize: 13 },
});
