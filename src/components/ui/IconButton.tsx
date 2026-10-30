import { Icon, IconName } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { fx } from '@/lib/feedback';
import { color, control, iconSize, iconStroke, radius, themedStyles } from '@/theme/tokens';

/** A round icon-only button: tonal by default, `plain` without a fill (back arrows, close). Always 48 to tap. */
export function IconButton({ icon, onPress, label, plain }: { icon: IconName; onPress?: () => void; label: string; plain?: boolean }) {
  return (
    <PressScale
      onPress={() => {
        fx.tap();
        onPress?.();
      }}
      pressedScale={0.9}
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
