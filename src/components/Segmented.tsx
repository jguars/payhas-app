import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { color, control, font, radius, size, themedStyles } from '@/theme/tokens';

type Props<T> = {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
  /** Word labels (tabs): the larger body size. */
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

const styles = themedStyles(() => ({
  segments: { flexDirection: 'row', minHeight: control.md, padding: 4, borderRadius: radius.pill, backgroundColor: color.surface1 },
  pill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: radius.pill, backgroundColor: color.inverse },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { color: color.text2, fontFamily: font.bold, fontSize: size.small },
  words: { fontFamily: font.bold, fontSize: size.body },
  textOn: { color: color.onInverse },
}));
