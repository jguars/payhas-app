import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { TopicIcon } from '@/components/ui/TopicIcon';
import { topicLabel, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { alpha, border, color, control, font, radius, space, themedStyles, topicTints, type } from '@/theme/tokens';

import type { Topic } from './useDiscover';

type Props = { topics: Topic[]; selected: string | null; onSelect: (slug: string | null) => void; baseIndex?: number };

/**
 * Two-up topic tiles (after Roku's categories): a tinted surface with the
 * topic's hand-drawn sticker icon in the corner and its name at the bottom. Selecting one
 * rings it in its colour and gives the emoji a little tilt.
 */
export function TopicGrid({ topics, selected, onSelect, baseIndex = 0 }: Props) {
  return (
    <View style={styles.grid}>
      {topics.map((t, i) => (
        <Enter key={t.slug} index={baseIndex + Math.min(i, 8)} style={styles.cell}>
          <TopicTile
            topic={t}
            swatch={topicTints[i % topicTints.length]}
            on={selected === t.slug}
            onPress={() => {
              fx.tab();
              onSelect(selected === t.slug ? null : t.slug);
            }}
          />
        </Enter>
      ))}
    </View>
  );
}

function TopicTile({ topic, swatch, on, onPress }: { topic: Topic; swatch: string; on: boolean; onPress: () => void }) {
  const { t } = useT();
  const label = topicLabel(t, topic.slug, topic.label);
  const sel = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    sel.value = withSpring(on ? 1 : 0, spring.bouncy);
  }, [on, sel]);

  const ring = useAnimatedStyle(() => ({ opacity: Math.min(1, sel.value) }));
  const emoji = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-8 + 14 * sel.value}deg` }, { scale: 1 + 0.14 * sel.value }],
  }));

  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}>
      <View style={[styles.tile, { backgroundColor: alpha(swatch, color.scheme === 'light' ? 0.22 : 0.16) }]}>
        <Animated.View style={[styles.icon, emoji]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <TopicIcon slug={topic.slug} tint={swatch} emoji={topic.emoji} size={control.lg} />
        </Animated.View>
        <View style={styles.foot}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: swatch }, ring]} />
      </View>
    </PressScale>
  );
}

const styles = themedStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  // Two up with one gap between: each cell is half the row less half a gap.
  cell: { flexBasis: '47%', flexGrow: 1 },
  tile: { height: control.lg * 2, borderRadius: radius.md, overflow: 'hidden', padding: space.md, justifyContent: 'flex-end' },
  icon: { position: 'absolute', right: space.sm, top: space.sm },
  foot: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  label: { flexShrink: 1, color: color.text, fontFamily: font.title, ...type.lead },
  ring: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.md, borderWidth: border.strong },
}));
