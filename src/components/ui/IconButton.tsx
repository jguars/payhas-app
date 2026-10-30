import { Icon, IconName } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { fx } from '@/lib/feedback';
import { color, control, iconSize, iconStroke, radius, themedStyles } from '@/theme/tokens';

/** A round icon-only button: tonal by default, `plain` without a fill (back arrows, close). Always 48 to tap. */
/** `testID` lets UI tests (Maestro) tap it on both Android and iOS. */
export function IconButton({ icon, onPress, label, plain, testID }: { icon: IconName; onPress?: () => void; label: string; plain?: boolean; testID?: string }) {
  return (
    <PressScale
      onPress={() => {
        fx.tap();
        onPress?.();
      }}
      pressedScale={0.9}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.base, !plain && styles.tonal]}
    >
      <Icon name={icon} size={iconSize.lg} color={color.text} strokeWidth={iconStroke(iconSize.lg)} />
    </PressScale>
  );
}

const styles = themedStyles(() => ({
  base: { width: control.md, height: control.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tonal: { backgroundColor: color.surface2 },
}));
