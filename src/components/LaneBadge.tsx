import { Pressable, Text } from 'react-native';

import { Icon } from '@/components/Icon';
import { laneKey, useT } from '@/i18n';
import { alpha, color, font, Lane, lane as lanes, radius, size, space, themedStyles } from '@/theme/tokens';

/**
 * `label` overrides the lane name, e.g. "Parent" for the family owner's profile.
 * `filled` (default): the lane pill on pages — lane fill, ink text, same in every theme.
 * `media`: over video — a dark translucent ground with the bright lane colour.
 */
type Props = { lane: Lane; label?: string; onPress?: () => void; variant?: 'filled' | 'media' };

export function LaneBadge({ lane, label, onPress, variant = 'filled' }: Props) {
  const l = lanes[lane];
  const { t } = useT();
  const name = label ?? t(laneKey(lane));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('common.laneBadge', { lane: name, ages: l.ages })}
      hitSlop={8}
      disabled={!onPress}
      style={[styles.badge, variant === 'filled' ? { backgroundColor: l.color } : styles.media]}
    >
      {variant === 'media' && <Icon name="shield" size={12} color={l.color} strokeWidth={2.4} />}
      <Text style={[styles.label, { color: variant === 'filled' ? color.ink : l.color }]}>{name}</Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, minHeight: 24, paddingHorizontal: 10, borderRadius: radius.pill },
  // Over video: no outline, a faint dark ground; the lane colour carries the meaning.
  media: { minHeight: 28, paddingLeft: space.sm, backgroundColor: alpha(color.ink, 0.32) },
  label: { fontFamily: font.bold, fontSize: size.caption, letterSpacing: 0.2 },
}));
