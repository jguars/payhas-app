import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/Icon';
import { font, Lane, lane as lanes } from '@/theme/tokens';

type Props = { lane: Lane; onPress?: () => void };

export function LaneBadge({ lane, onPress }: Props) {
  const l = lanes[lane];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${l.label} lane, ages ${l.ages}. Switch profile`}
      hitSlop={6}
      style={[styles.badge, { borderColor: l.color + '99' }]}
    >
      <Icon name="shield" size={14} color={l.color} strokeWidth={2.4} />
      <Text style={[styles.label, { color: l.color }]}>{l.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingLeft: 8,
    paddingRight: 11,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(10,10,15,0.45)',
  },
  label: { fontFamily: font.bold, fontSize: 12 },
});
