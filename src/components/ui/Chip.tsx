import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon, IconName } from '@/components/Icon';
import { fx } from '@/lib/feedback';
import { color, control, font, radius, size as type, space, themedStyles } from '@/theme/tokens';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  emoji?: string;
  icon?: IconName;
  size?: 'md' | 'lg';
  disabled?: boolean;
  accessibilityRole?: 'checkbox' | 'radio' | 'button';
  right?: ReactNode;
  /** Art before the label (a topic icon); the emoji/icon props cover the simple cases. */
  leading?: ReactNode;
};

/**
 * The chunky, tactile chip (after Vocabulary and Duolingo ABC): a 2 px ink
 * outline on a solid fill, with a hard ledge underneath that it presses down
 * into. Selected = the one selected style (inverse fill, onInverse label), in
 * every theme. Used for topics, years, months and any "pick some" list.
 */
export function Chip({ label, selected, onPress, emoji, icon, size = 'md', disabled, accessibilityRole = 'checkbox', right, leading }: Props) {
  const tint = color.inverse;
  const h = size === 'lg' ? control.lg : control.md;
  return (
    <Pressable
      onPress={() => {
        fx.toggle(!selected);
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ checked: accessibilityRole === 'checkbox' ? !!selected : undefined, selected: accessibilityRole === 'radio' ? !!selected : undefined, disabled }}
      style={{ opacity: disabled ? 0.4 : 1 }}
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
            {leading}
            {!!emoji && <Text style={styles.emoji}>{emoji}</Text>}
            {!!icon && <Icon name={icon} size={16} color={selected ? color.onInverse : color.text} strokeWidth={2.4} />}
            <Text style={[styles.label, size === 'lg' && { fontSize: type.body }, selected && { color: color.onInverse }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
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

const styles = themedStyles(() => ({
  ledge: { position: 'absolute', left: 0, right: 0, borderRadius: radius.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.sm, borderWidth: 2, borderColor: color.line, backgroundColor: color.surface1 },
  emoji: { fontSize: 18 },
  label: { color: color.text, fontFamily: font.bold, fontSize: type.body },
}));
