import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { PressScale } from '@/components/motion/PressScale';
import { border, color, elevation, radius, space, themedStyles } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  /** Child areas: sits on a hard ledge and feels pressable. Parent areas leave it flat. */
  tactile?: boolean;
  /** Hero cards (featured game, plan hero) use the large radius. */
  hero?: boolean;
  /** No inner padding — for cards that start with full-bleed art. */
  flush?: boolean;
  /** The recommended choice among cards (a plan): a strong ember outline. */
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** The one card: surface 1, radius md (lg for heroes), padding lg. */
export function Card({ children, tactile, hero, flush, selected, onPress, accessibilityLabel, style }: Props) {
  const r = hero ? radius.lg : radius.md;
  const body = <View style={[styles.card, { borderRadius: r }, !flush && styles.padded, selected && styles.selected, style]}>{children}</View>;
  const wrapped = tactile ? <View style={[styles.ledge, { borderRadius: r }]}>{body}</View> : body;
  if (!onPress) return wrapped;
  return (
    <PressScale onPress={onPress} pressedScale={0.97} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {wrapped}
    </PressScale>
  );
}

const styles = themedStyles(() => ({
  card: { backgroundColor: color.surface1, overflow: 'hidden' },
  padded: { padding: space.lg, gap: space.md },
  selected: { borderWidth: border.strong, borderColor: color.ember },
  ledge: { paddingBottom: elevation.ledge, backgroundColor: color.line },
}));
