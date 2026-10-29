import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { color, font } from '@/theme/tokens';

type Props<T> = {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
  /** Word labels (tabs) instead of numbers: UI type, not mono. */
  words?: boolean;
};

/** Evenly split options with a pill that slides to the chosen one. */
export function Segmented<T>({ options, value, onChange, label, words }: Props<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.indexOf(value));
  const x = useSharedValue(index);
  useEffect(() => {
    x.value = withSpring(index, spring.snappy);
  }, [index, x]);
  const seg = width / options.length;
  const pill = useAnimatedStyle(() => ({ width: seg, transform: [{ translateX: x.value * seg }] }));

  return (
    <View style={styles.segments} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)} accessibilityRole="radiogroup">
      {width > 0 && <Animated.View style={[styles.pill, pill]} />}
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={String(o)}
            onPress={() => {
              if (on) return;
              fx.tab();
              onChange(o);
            }}
            style={styles.seg}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.text, words && styles.words, on && styles.textOn]} numberOfLines={1}>
              {label(o)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', minHeight: 48, padding: 4, borderRadius: 14, backgroundColor: color.ink },
  pill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 10, backgroundColor: color.surface2, borderWidth: 1, borderColor: color.line },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { color: color.text3, fontFamily: font.mono, fontSize: 13 },
  words: { fontFamily: font.bold, fontSize: 15 },
  textOn: { color: color.text },
});
