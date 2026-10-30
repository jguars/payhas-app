import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon, IconName } from '@/components/Icon';
import { Toggle } from '@/components/motion/Toggle';
import { fx } from '@/lib/feedback';
import { border, color, control, font, iconSize, iconStroke, radius, space, themedStyles, type } from '@/theme/tokens';

/** A titled group of rows on one card (settings-list style). */
export function ListGroup({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      {!!title && (
        <Text style={styles.groupTitle} accessibilityRole="header" aria-level={2}>
          {title}
        </Text>
      )}
      <View style={styles.group}>{children}</View>
      {!!footer && <Text style={styles.footer}>{footer}</Text>}
    </View>
  );
}

/** The neutral icon tile at the start of a row. Colour comes from meaning only: pass `danger` for destructive rows. */
export function RowIcon({ icon, danger }: { icon: IconName; danger?: boolean }) {
  return (
    <View style={styles.tile}>
      <Icon name={icon} size={iconSize.md} color={danger ? color.danger : color.text2} strokeWidth={iconStroke(iconSize.md)} />
    </View>
  );
}

type RowProps = {
  label: string;
  sub?: ReactNode;
  leading?: ReactNode;
  icon?: IconName;
  /** Right side: a short value in words ("Free", "60 min"), never code type. */
  value?: ReactNode;
  toggle?: boolean;
  onPress?: () => void;
  danger?: boolean;
  /** First row in a group: no divider above. */
  first?: boolean;
  chevron?: boolean;
  accessibilityLabel?: string;
};

/** One row: leading tile or avatar, label with an optional line under it, then a value, a switch or a chevron. */
export function ListRow({ label, sub, leading, icon, value, toggle, onPress, danger, first, chevron = !!onPress && toggle == null, accessibilityLabel }: RowProps) {
  const body = (
    <>
      {leading ?? (icon ? <RowIcon icon={icon} danger={danger} /> : null)}
      <View style={styles.middle}>
        <Text style={[styles.label, danger && { color: color.danger }]} numberOfLines={1}>
          {label}
        </Text>
        {typeof sub === 'string' ? (
          <Text style={styles.sub} numberOfLines={3}>
            {sub}
          </Text>
        ) : (
          sub
        )}
      </View>
      {typeof value === 'string' ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        value
      )}
      {toggle != null && <Toggle on={toggle} />}
      {chevron && <Icon name="chevron" size={iconSize.sm} color={color.text3} strokeWidth={iconStroke(iconSize.sm)} />}
    </>
  );
  const style = [styles.row, !first && styles.divider];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      onPress={() => {
        if (toggle != null) fx.toggle(!toggle);
        else fx.tap();
        onPress();
      }}
      accessibilityRole={toggle != null ? 'switch' : 'button'}
      accessibilityState={toggle != null ? { checked: toggle } : undefined}
      aria-checked={toggle ?? undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [style, pressed && { backgroundColor: color.surface2 }]}
    >
      {body}
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  groupTitle: { color: color.text, fontFamily: font.title, ...type.lead },
  group: { backgroundColor: color.surface1, borderRadius: radius.md, overflow: 'hidden' },
  footer: { color: color.text3, fontFamily: font.medium, ...type.caption, paddingHorizontal: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: control.lg + space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  divider: { borderTopWidth: border.hairline, borderTopColor: color.line },
  middle: { flex: 1, gap: 2 },
  label: { color: color.text, fontFamily: font.semibold, ...type.body },
  sub: { color: color.text2, fontFamily: font.medium, ...type.small },
  value: { color: color.text2, fontFamily: font.semibold, ...type.small },
  tile: { width: control.sm, height: control.sm, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface2 },
}));
