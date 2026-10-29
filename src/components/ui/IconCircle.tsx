import { View } from 'react-native';

import { Icon, IconName } from '@/components/Icon';
import { color } from '@/theme/tokens';

/** A filled colour circle with an ink icon (after TikTok's inbox categories). */
export function IconCircle({ icon, tint, size = 44 }: { icon: IconName; tint: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.46} color={color.ink} strokeWidth={2.4} />
    </View>
  );
}
