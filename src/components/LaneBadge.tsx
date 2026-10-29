import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/Icon';
import { laneKey, useT } from '@/i18n';
import { alpha, color, font, Lane, lane as lanes } from '@/theme/tokens';

type Props = { lane: Lane; onPress?: () => void };

export function LaneBadge({ lane, onPress }: Props) {
  const l = lanes[lane];
  const { t } = useT();
  const name = t(laneKey(lane));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('common.laneBadge', { lane: name, ages: l.ages })}
      hitSlop={8}
      style={styles.badge}
    >
      <Icon name="shield" size={12} color={l.color} strokeWidth={2.4} />
      <Text style={[styles.label, { color: l.color }]}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Quiet: no outline, a faint translucent ground; the lane colour carries the meaning.
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 999,
    backgroundColor: alpha(color.ink, 0.32),
  },
  label: { fontFamily: font.bold, fontSize: 12, letterSpacing: 0.2 },
});
