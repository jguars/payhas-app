import { Text, View } from 'react-native';

import { Icon, IconName } from '@/components/Icon';
import { color, font, iconSize, iconStroke, radius, space, themedStyles, type } from '@/theme/tokens';

type Tone = 'neutral' | 'plus' | 'success' | 'danger';

/**
 * A small pill label: plan names, counts, states. Lane badges use LaneBadge
 * (lane colours mean age only). `plus` is neutral with the sparkle — ember is
 * for actions, not labels.
 */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const fg = tone === 'plus' ? color.text : tone === 'success' ? color.success : tone === 'danger' ? color.danger : color.text2;
  return (
    <View style={styles.badge}>
      {!!icon && <Icon name={icon} size={12} color={fg} strokeWidth={iconStroke(iconSize.sm)} />}
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 24, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: color.surface2, alignSelf: 'flex-start' },
  text: { fontFamily: font.bold, ...type.caption },
}));
