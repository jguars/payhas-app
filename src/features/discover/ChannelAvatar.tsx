import { View } from 'react-native';

import { TopicIcon } from '@/components/ui/TopicIcon';
import { color } from '@/theme/tokens';

import type { ChannelLook } from './useChannels';

/**
 * A channel's face: its hand-drawn topic sticker on a disc of its colour. The
 * sticker is filled in bone so it reads on any of the lane colours.
 */
export function ChannelAvatar({ look, size = 56 }: { look: ChannelLook; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: look.tint, alignItems: 'center', justifyContent: 'center' }}>
      <TopicIcon slug={look.sticker} tint={color.text} size={size * 0.68} />
    </View>
  );
}
