import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { useT } from '@/i18n';
import { spring } from '@/theme/motion';
import { alpha, color, font, size, space, themedStyles } from '@/theme/tokens';

type Props = { value: string; onChange: (v: string) => void; suggestions: string[] };

/**
 * Search with a placeholder that rolls through this lane's topics while idle,
 * and a border that warms to ember on focus.
 */
export function SearchField({ value, onChange, suggestions }: Props) {
  const reduce = useReducedMotion();
  const { t, lang } = useT();
  const [focused, setFocused] = useState(false);
  const [i, setI] = useState(0);
  const focus = useSharedValue(0);

  const idle = !focused && value.length === 0 && suggestions.length > 1 && !reduce;
  useEffect(() => {
    if (!idle) return;
    const id = setInterval(() => setI((n) => (n + 1) % suggestions.length), 2400);
    return () => clearInterval(id);
  }, [idle, suggestions.length]);

  useEffect(() => {
    focus.value = withSpring(focused ? 1 : 0, spring.snappy);
  }, [focused, focus]);

  // Focus warms the field by fading in an ember-ringed layer (opacity only).
  const ring = useAnimatedStyle(() => ({ opacity: Math.min(1, focus.value) }));
  const glass = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.12 * focus.value }, { rotate: `${-12 * focus.value}deg` }],
  }));

  const word = suggestions[i % Math.max(1, suggestions.length)] ?? '';

  return (
    <View style={styles.box}>
      <Animated.View pointerEvents="none" style={[styles.ring, ring]} />
      <Animated.View style={glass}>
        <Icon name="search" size={22} color={focused ? color.text : color.text3} strokeWidth={2.2} />
      </Animated.View>
      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={t('discover.search')}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.input}
        />
        {value.length === 0 && (
          <View pointerEvents="none" style={styles.placeholder}>
            <Animated.Text style={styles.placeholderText}>{t('discover.searchPrefix')}</Animated.Text>
            <Animated.Text
              key={word}
              entering={reduce ? undefined : FadeInDown.duration(280)}
              exiting={reduce ? undefined : FadeOutUp.duration(200)}
              style={[styles.placeholderText, styles.placeholderWord]}
            >
              {word.toLocaleLowerCase(lang)}
            </Animated.Text>
          </View>
        )}
      </View>
      {value.length > 0 && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)}>
          <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel={t('discover.clearSearch')} hitSlop={space.md} style={styles.clear}>
            <Icon name="close" size={14} color={color.ink} strokeWidth={3} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, paddingHorizontal: 20, borderRadius: 28, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface1 },
  ring: { position: 'absolute', left: -1, right: -1, top: -1, bottom: -1, borderRadius: 28, borderWidth: 1.5, borderColor: alpha(color.ember, 0.7), backgroundColor: color.surface2 },
  field: { flex: 1, height: '100%', justifyContent: 'center' },
  input: { flex: 1, color: color.text, fontFamily: font.medium, fontSize: size.body, outlineStyle: 'none' } as never,
  placeholder: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  placeholderText: { color: color.text3, fontFamily: font.medium, fontSize: size.body },
  placeholderWord: { color: color.text2 },
  clear: { width: 24, height: 24, borderRadius: 12, backgroundColor: color.text3, alignItems: 'center', justifyContent: 'center' },
}));
