import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Text as SvgText } from 'react-native-svg';

import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { FeedVideo } from '@/features/feed/data';
import { color, font, space, themedStyles } from '@/theme/tokens';

const POSTER_W = 108;
const POSTER_H = 156;
/** How far the poster slides over its numeral. */
const OVERLAP = 20;

type Props = { videos: FeedVideo[]; onOpen: (v: FeedVideo) => void; baseIndex?: number };

/**
 * The Top 10 row (after Roku): each poster sits on a huge outlined rank
 * numeral, covering its right side so the number peeks out from the left edge.
 */
export function TopTen({ videos, onOpen, baseIndex = 0 }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.row}>
      {videos.map((v, i) => {
        const n = i + 1;
        const numW = n >= 10 ? 126 : 76;
        return (
          <Enter key={v.id} index={baseIndex + Math.min(i, 5)} rise={18}>
            <PressScale
              onPress={() => onOpen(v)}
              accessibilityRole="button"
              accessibilityLabel={`${n}. ${v.caption}`}
              style={{ width: numW + POSTER_W - OVERLAP, height: POSTER_H }}
            >
              <Svg width={numW} height={POSTER_H} style={styles.num} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <SvgText
                  x={numW - 2}
                  y={POSTER_H - 4}
                  textAnchor="end"
                  fontSize={136}
                  fontFamily={font.display}
                  letterSpacing={n >= 10 ? -10 : 0}
                  fill={color.ink}
                  stroke={color.text2}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                >
                  {String(n)}
                </SvgText>
              </Svg>
              <View style={[styles.poster, { left: numW - OVERLAP }]}>
                <Image source={v.thumb} cachePolicy="memory-disk" recyclingKey={v.id} style={styles.fill} contentFit="cover" />
              </View>
            </PressScale>
          </Enter>
        );
      })}
    </ScrollView>
  );
}

const styles = themedStyles(() => ({
  // The row runs to the screen edges; the screen's own padding moves inside it.
  bleed: { marginHorizontal: -space.lg },
  row: { paddingHorizontal: space.lg, gap: 6 },
  num: { position: 'absolute', left: 0, top: 0 },
  poster: { position: 'absolute', top: 0, width: POSTER_W, height: POSTER_H, borderRadius: 14, overflow: 'hidden', backgroundColor: color.surface1 },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
}));
