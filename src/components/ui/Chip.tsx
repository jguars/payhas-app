import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, IconName } from '@/components/Icon';
import { fx } from '@/lib/feedback';
import { color, font } from '@/theme/tokens';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  emoji?: string;
  icon?: IconName;
  /** Fill when selected; defaults to the text colour (ink label on light chip). */
  tint?: string;
  size?: 'md' | 'lg';
  disabled?: boolean;
  accessibilityRole?: 'checkbox' | 'radio' | 'button';
  right?: ReactNode;
};

/**
 * The chunky, tactile chip (after Vocabulary and Duolingo ABC): a 2 px ink
 * outline on a solid fill, with a hard ledge underneath that it presses down
 * into. Selected = filled with the tint. Used for topics, years, months and
 * any "pick some" list kids touch.
 */
export function Chip({ label, selected, onPress, emoji, icon, tint = color.text, size = 'md', disabled, accessibilityRole = 'checkbox', right }: Props) {
  const h = size === 'lg' ? 52 : 48;
  return (
    <Pressable
      onPress={() => {
        fx.toggle(!selected);
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ checked: accessibilityRole === 'checkbox' ? !!selected : undefined, selected: accessibilityRole === 'radio' ? !!selected : undefined, disabled }}
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      {({ pressed }) => (
        <View style={{ paddingBottom: 3 }}>
          <View style={[styles.ledge, { top: 3, bottom: 0, backgroundColor: selected ? shade(tint) : color.line }]} />
          <View
            style={[
              styles.chip,
              { minHeight: h, paddingVertical: 6, paddingHorizontal: size === 'lg' ? 18 : 14, transform: [{ translateY: pressed ? 3 : 0 }] },
              selected ? { backgroundColor: tint, borderColor: shade(tint) } : null,
            ]}
          >
            {!!emoji && <Text style={styles.emoji}>{emoji}</Text>}
            {!!icon && <Icon name={icon} size={16} color={selected ? color.ink : color.text} strokeWidth={2.4} />}
            <Text style={[styles.label, size === 'lg' && { fontSize: 16 }, selected && { color: color.ink }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {label}
            </Text>
            {right}
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** A darker edge of the same colour for the ledge under a filled chip. */
function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const k = 0.62;
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const styles = StyleSheet.create({
  ledge: { position: 'absolute', left: 0, right: 0, borderRadius: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 2, borderColor: color.line, backgroundColor: color.surface1 },
  emoji: { fontSize: 18 },
  label: { color: color.text, fontFamily: font.bold, fontSize: 15 },
});
