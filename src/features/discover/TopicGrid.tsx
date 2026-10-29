import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { TopicIcon } from '@/components/ui/TopicIcon';
import { topicLabel, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { color, font, lane, size, themedStyles } from '@/theme/tokens';

import type { Topic } from './useDiscover';

/** Read when drawn, so the swatches follow the theme. */
const swatches = () => [color.ember, lane.kids.color, lane.teen.color, lane.little.color, lane.adult.color];

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
            swatch={swatches()[i % 5]}
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
      <View style={[styles.tile, { backgroundColor: swatch + '1F' }]}>
        <Animated.View style={[styles.icon, emoji]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <TopicIcon slug={topic.slug} tint={swatch} emoji={topic.emoji} size={58} />
        </Animated.View>
        <View style={styles.foot}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          {topic.count > 0 && <Text style={[styles.count, { color: swatch }]}>{topic.count}</Text>}
        </View>
        <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: swatch }, ring]} />
      </View>
    </PressScale>
  );
}

const styles = themedStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48.5%' },
  tile: { height: 104, borderRadius: 18, overflow: 'hidden', padding: 14, justifyContent: 'flex-end' },
  icon: { position: 'absolute', right: 8, top: 8 },
  foot: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  label: { flexShrink: 1, color: color.text, fontFamily: font.title, fontSize: size.lead, letterSpacing: -0.2 },
  count: { fontFamily: font.mono, fontSize: size.caption },
  ring: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 18, borderWidth: 2 },
}));
