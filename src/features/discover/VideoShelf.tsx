import { Image } from 'expo-image';
import { ScrollView, Text, View } from 'react-native';

import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FeedVideo } from '@/features/feed/data';
import { useT } from '@/i18n';
import { color, font, layout, radius, space, themedStyles, type } from '@/theme/tokens';

type Props = { title: string; videos: FeedVideo[]; onOpen: (v: FeedVideo) => void; onSeeAll?: () => void; index?: number };

/**
 * A titled row of video posters (3:4) with a two-line caption under each
 * (after Netflix Kids and Calm). The next poster peeks past the edge so the
 * row reads as scrollable. No counts, no ranks: nothing to compete over.
 */
export function VideoShelf({ title, videos, onOpen, onSeeAll, index = 0 }: Props) {
  const { t } = useT();
  if (videos.length === 0) return null;
  return (
    <Enter index={index} style={styles.wrap}>
      <SectionHeader title={title} action={onSeeAll ? t('discover.seeAll') : undefined} onAction={onSeeAll} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.bleed}>
        {videos.map((v) => (
          <PressScale key={v.id} onPress={() => onOpen(v)} accessibilityRole="button" accessibilityLabel={v.caption} style={styles.poster}>
            <View style={styles.image} aria-hidden importantForAccessibility="no-hide-descendants">
              <Image source={v.thumb} cachePolicy="memory-disk" recyclingKey={v.id} style={styles.fill} contentFit="cover" alt="" accessible={false} />
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
  wrap: { gap: space.xs },
  // The row runs to the screen edges while its first poster lines up with the page.
  bleed: { marginHorizontal: -layout.gutter },
  row: { gap: space.md, paddingHorizontal: layout.gutter },
  poster: { width: layout.poster.width, gap: space.sm },
  image: { width: layout.poster.width, height: layout.poster.height, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.surface2 },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  caption: { color: color.text, fontFamily: font.semibold, ...type.small },
}));
