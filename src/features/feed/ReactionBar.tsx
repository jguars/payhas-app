import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { REACTIONS } from '@/features/library/LibraryProvider';
import { spring } from '@/theme/motion';
import { color, radius } from '@/theme/tokens';

type Props = { mine: Set<string>; onPick: (emoji: string) => void };

/** Six big emoji in a pill that unfolds from the react button, one after another. */
export function ReactionBar({ mine, onPick }: Props) {
  return (
    <View style={styles.bar} accessibilityRole="menu">
      {REACTIONS.map((e, i) => (
        <ReactionChoice key={e} emoji={e} index={i} on={mine.has(e)} onPick={onPick} />
      ))}
    </View>
  );
}

function ReactionChoice({ emoji, index, on, onPick }: { emoji: string; index: number; on: boolean; onPick: (e: string) => void }) {
  const s = useSharedValue(0);
  useEffect(() => {
    // Unfold from the right (nearest the button) outward.
    s.value = withDelay((REACTIONS.length - 1 - index) * 35, withSpring(1, spring.bouncy));
  }, [index, s]);
  const anim = useAnimatedStyle(() => ({ opacity: Math.min(1, s.value), transform: [{ scale: s.value }, { translateY: (1 - s.value) * 12 }] }));
  return (
    <Animated.View style={anim}>
      <Pressable onPress={() => onPick(emoji)} accessibilityRole="menuitem" accessibilityState={{ selected: on }} style={[styles.choice, on && styles.choiceOn]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** A few copies of the picked emoji floating up the video and fading. */
export function FloatingEmoji({ emoji, fromX, fromY, onDone }: { emoji: string; fromX: number; fromY: number; onDone: () => void }) {
  const drifts = useMemo(() => [0, 1, 2, 3].map(() => ({ dx: (Math.random() - 0.5) * 90, delay: Math.random() * 220, size: 28 + Math.random() * 16 })), []);
  useEffect(() => {
    const t = setTimeout(onDone, 1700);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
      {drifts.map((d, i) => (
        <Floater key={i} emoji={emoji} x={fromX} y={fromY} {...d} />
      ))}
    </View>
  );
}

function Floater({ emoji, x, y, dx, delay, size }: { emoji: string; x: number; y: number; dx: number; delay: number; size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }));
  }, [delay, t]);
  const anim = useAnimatedStyle(() => ({
    opacity: t.value < 0.1 ? t.value * 10 : 1 - Math.max(0, (t.value - 0.55) / 0.45),
    transform: [{ translateX: dx * t.value + Math.sin(t.value * 6) * 8 }, { translateY: -260 * t.value }, { scale: 0.6 + 0.6 * Math.min(1, t.value * 3) }],
  }));
  return (
    <Animated.Text style={[{ position: 'absolute', left: x - size / 2, top: y - size / 2, fontSize: size }, anim]}>{emoji}</Animated.Text>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 4, padding: 6, borderRadius: radius.pill, backgroundColor: 'rgba(20,20,27,0.92)', borderWidth: 1, borderColor: color.line },
  choice: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  choiceOn: { backgroundColor: color.surface2 },
  emoji: { fontSize: 28 },
});
