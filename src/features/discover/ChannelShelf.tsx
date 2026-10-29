import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FeedVideo } from '@/features/feed/data';
import { useT } from '@/i18n';
import { color, font, space, themedStyles } from '@/theme/tokens';

import type { Channel } from './useDiscover';

type Props = { channel: Channel; onOpen: (v: FeedVideo) => void; onSeeAll: () => void; index?: number };

/** One channel's videos as a horizontal shelf (after Epidemic Sound). */
export function ChannelShelf({ channel, onOpen, onSeeAll, index = 0 }: Props) {
  const { t } = useT();
  return (
    <Enter index={index} style={styles.wrap}>
      <SectionHeader
        title={channel.name}
        subtitle={t('discover.channelVideos', { count: channel.videos.length })}
        action={t('discover.seeAll')}
        onAction={onSeeAll}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.row}>
        {channel.videos.map((v) => (
          <PressScale key={v.id} onPress={() => onOpen(v)} accessibilityRole="button" accessibilityLabel={v.caption} style={styles.item}>
            <View style={styles.poster}>
              <Image source={v.thumb} cachePolicy="memory-disk" recyclingKey={v.id} style={styles.fill} contentFit="cover" />
            </View>
            <Text style={styles.caption} numberOfLines={2}>
              {v.caption}
            </Text>
          </PressScale>
        ))}
      </ScrollView>
    </Enter>
  );
}

const styles = themedStyles(() => ({
  wrap: { gap: space.md },
  bleed: { marginHorizontal: -space.lg },
  row: { paddingHorizontal: space.lg, gap: 10 },
  item: { width: 124, gap: 8 },
  poster: { width: 124, height: 172, borderRadius: 14, overflow: 'hidden', backgroundColor: color.surface1 },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  caption: { color: color.text2, fontFamily: font.semibold, fontSize: 13, lineHeight: 17 },
}));
