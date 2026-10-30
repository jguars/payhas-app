import { ActivityIndicator, Text, View } from 'react-native';

import { Icon, IconName } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { fx } from '@/lib/feedback';
import { color, control, elevation, font, iconSize, iconStroke, radius, space, themedStyles, type } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'quiet' | 'destructive';

type Props = {
  label: string;
  onPress?: () => void;
  /** primary: the one ember action on a screen · secondary: tonal · quiet: text only · destructive: danger text on tonal. */
  variant?: Variant;
  /** lg 56 (block) for the screen's main action · md 48 for actions in cards · sm 40 inline (touch area still 48). */
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to the parent's width (default for lg). */
  block?: boolean;
  accessibilityLabel?: string;
  /** For UI tests (Maestro). */
  testID?: string;
};

/**
 * The one button family. Disabled is a tonal fill with muted text in every
 * variant — never a faded colour. Primary sits on a hard ledge like the
 * tactile cards and presses down into it.
 */
export function Button({ label, onPress, variant = 'primary', size = 'lg', icon, disabled, loading, block = size === 'lg', accessibilityLabel, testID }: Props) {
  const off = disabled || loading;
  const fg = off ? color.text3 : variant === 'primary' ? color.ink : variant === 'destructive' ? color.danger : color.text;
  const lg = size === 'lg';
  const sm = size === 'sm';
  return (
    <PressScale
      onPress={() => {
        fx.tap();
        onPress?.();
      }}
      disabled={off}
      pressedScale={0.97}
      // Small buttons draw at 40 but take touches across the 48 minimum.
      hitSlop={sm ? (control.md - control.sm) / 2 : undefined}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={[block ? styles.block : styles.inline, variant === 'primary' && !off && styles.ledge]}
    >
      <View
        style={[
          styles.base,
          { height: lg ? control.lg : sm ? control.sm : control.md, paddingHorizontal: sm ? space.lg : space.xl },
          off ? styles.off : variant === 'primary' ? styles.primary : variant === 'quiet' ? styles.quiet : styles.tonal,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {!!icon && <Icon name={icon} size={sm ? iconSize.sm : iconSize.md} color={fg} strokeWidth={iconStroke(sm ? iconSize.sm : iconSize.md)} />}
            <Text style={[sm ? styles.labelSm : styles.labelLg, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {label}
            </Text>
          </>
        )}
      </View>
    </PressScale>
  );
}

const styles = themedStyles(() => ({
  block: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  ledge: { borderRadius: radius.pill, paddingBottom: elevation.ledgeButton, backgroundColor: color.emberEdge },
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, borderRadius: radius.pill },
  primary: { backgroundColor: color.ember },
  tonal: { backgroundColor: color.surface2 },
  quiet: { backgroundColor: 'transparent' },
  off: { backgroundColor: color.surface2 },
  labelLg: { fontFamily: font.bold, ...type.body },
  labelSm: { fontFamily: font.bold, ...type.small },
}));
