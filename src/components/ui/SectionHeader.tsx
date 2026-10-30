import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { color, control, font, iconSize, iconStroke, space, themedStyles, type } from '@/theme/tokens';

/** Shelf / section title with an optional quiet "See all ›" (after Hulu and Epidemic Sound). */
export function SectionHeader({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <Text style={styles.title} accessibilityRole="header" aria-level={2} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {!!action && (
        <Pressable onPress={onAction} hitSlop={space.sm} accessibilityRole="button" style={styles.action}>
          <Text style={styles.actionText}>{action}</Text>
          <Icon name="chevron" size={iconSize.sm} color={color.text2} strokeWidth={iconStroke(iconSize.sm)} />
        </Pressable>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  // Centred: the 48 px "See all" target and the title share one middle line.
  titles: { flex: 1, gap: space.xs / 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { color: color.text, fontFamily: font.title, ...type.title },
  subtitle: { color: color.text3, fontFamily: font.medium, ...type.small },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.xs / 2, minHeight: control.md, minWidth: control.md },
  actionText: { color: color.text2, fontFamily: font.semibold, ...type.small },
}));
