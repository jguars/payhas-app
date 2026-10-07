import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { spring } from '@/theme/motion';
import { color, font } from '@/theme/tokens';

import type { Topic } from './useDiscover';

const SWATCHES = [color.ember, '#4FE3B0', '#78A6FF', '#FFD25E', '#C3A2FF'];

type Props = { topics: Topic[]; selected: string | null; onSelect: (slug: string | null) => void; baseIndex?: number };

/** Two-up topic tiles. Selecting one tips its swatch into a diamond and tints the border. */
export function TopicGrid({ topics, selected, onSelect, baseIndex = 0 }: Props) {
  return (
    <View style={styles.grid}>
      {topics.map((t, i) => (
        <Enter key={t.slug} index={baseIndex + i} style={styles.cell}>
          <TopicTile
            topic={t}
            swatch={SWATCHES[i % SWATCHES.length]}
            on={selected === t.slug}
            onPress={() => onSelect(selected === t.slug ? null : t.slug)}
          />
        </Enter>
      ))}
    </View>
  );
}

function TopicTile({ topic, swatch, on, onPress }: { topic: Topic; swatch: string; on: boolean; onPress: () => void }) {
  const sel = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    sel.value = withSpring(on ? 1 : 0, spring.bouncy);
  }, [on, sel]);

  const tile = useAnimatedStyle(() => ({
    borderColor: interpolateColor(Math.min(1, sel.value), [0, 1], [color.line, swatch]),
    backgroundColor: interpolateColor(Math.min(1, sel.value), [0, 1], [color.surface1, color.surface2]),
  }));
  const dot = useAnimatedStyle(() => ({
    transform: [{ rotate: `${45 * sel.value}deg` }, { scale: 1 + 0.3 * sel.value }],
  }));

  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={topic.label}>
      <Animated.View style={[styles.tile, tile]}>
        <Animated.View style={[styles.swatch, { backgroundColor: swatch }, dot]} />
        <Text style={styles.label} numberOfLines={1}>
          {topic.label}
        </Text>
        {topic.count > 0 && <Text style={styles.count}>{topic.count}</Text>}
      </Animated.View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48.8%' },
  tile: { height: 52, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  label: { flex: 1, color: color.text, fontFamily: font.semibold, fontSize: 14 },
  count: { color: color.text3, fontFamily: font.mono, fontSize: 12 },
});
