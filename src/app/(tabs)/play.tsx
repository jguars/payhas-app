import { router, useIsFocused } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';

import { Icon } from '@/components/Icon';
import { StatusScrim } from '@/components/StatusScrim';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { useFamily } from '@/features/family/FamilyProvider';
import { BUBBLES, MEMORY, useBest } from '@/features/games/shared';
import { TimesUp } from '@/features/library/TimesUp';
import { useScreenTime } from '@/features/library/useScreenTime';
import { color, font, Lane, radius, space } from '@/theme/tokens';

export default function PlayScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const { current } = useFamily();
  const { lock } = useScreenTime();
  if (!current) return <View style={styles.root} />;
  const lane = current.lane;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: barSpace }]} showsVerticalScrollIndicator={false}>
        <Enter index={0}>
          <Text style={styles.title} accessibilityRole="header">
            Play
          </Text>
        </Enter>
        <Enter index={1}>
          <GameCard
            title="Bubble Pop"
            sub={BUBBLES[lane].targets ? `Find the right ones · ${BUBBLES[lane].round}s` : 'Pop as many as you like'}
            tint="#78A6FF"
            best={<Best game="bubbles" lane={lane} focused={focused} format={(n) => `${n} pts`} />}
            onPress={() => router.push('/games/bubbles')}
          >
            <BubblesPreview active={focused} />
          </GameCard>
        </Enter>
        <Enter index={2}>
          <GameCard
            title="Memory Match"
            sub={`${MEMORY[lane].pairs} pairs${MEMORY[lane].timed ? ' · against the clock' : ''}`}
            tint="#FFD25E"
            best={
              lane !== 'little' && (
                <Best game="memory" lane={lane} focused={focused} format={(n) => (MEMORY[lane].timed ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : `${n} moves`)} />
              )
            }
            onPress={() => router.push('/games/memory')}
          >
            <MemoryPreview active={focused} />
          </GameCard>
        </Enter>
      </ScrollView>
      <StatusScrim />
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

function Best({ game, lane, focused, format }: { game: 'bubbles' | 'memory'; lane: Lane; focused: boolean; format: (n: number) => string }) {
  const { read } = useBest(game, lane);
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    if (focused) setValue(read()); // re-read after coming back from a game
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps
  if (value == null) return null;
  return (
    <View style={styles.best}>
      <Icon name="star" size={12} color="#FFD25E" filled />
      <Text style={styles.bestText}>{format(value)}</Text>
    </View>
  );
}

function GameCard({ title, sub, tint, best, onPress, children }: { title: string; sub: string; tint: string; best: ReactNode; onPress: () => void; children: ReactNode }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} style={styles.card}>
      <View style={[styles.stage, { backgroundColor: tint + '1F' }]}>{children}</View>
      <View style={styles.cardFoot}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSub}>{sub}</Text>
        </View>
        {best}
        <View style={[styles.go, { backgroundColor: tint }]}>
          <Icon name="play" size={16} color={color.ink} />
        </View>
      </View>
    </PressScale>
  );
}

/** Bubbles drifting up through the card on a loop. */
function BubblesPreview({ active }: { active: boolean }) {
  const specs = [
    { x: '12%', s: 46, d: 0, e: '🐸' },
    { x: '34%', s: 34, d: 900, e: '🐥' },
    { x: '55%', s: 54, d: 400, e: '🐼' },
    { x: '76%', s: 38, d: 1500, e: '🦊' },
    { x: '86%', s: 30, d: 2300, e: '🐙' },
  ];
  return (
    <>
      {specs.map((b, i) => (
        <FloatBubble key={i} {...b} active={active} />
      ))}
    </>
  );
}

function FloatBubble({ x, s, d, e, active }: { x: string; s: number; d: number; e: string; active: boolean }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 0.5 : 0);
  useEffect(() => {
    if (reduce || !active) return;
    t.value = 0;
    t.value = withDelay(d, withRepeat(withTiming(1, { duration: 3400, easing: Easing.linear }), -1, false));
  }, [active, d, reduce, t]);
  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.1, 0.85, 1], [0, 1, 1, 0]),
    transform: [{ translateY: interpolate(t.value, [0, 1], [150, -s]) }, { translateX: Math.sin(t.value * Math.PI * 2) * 8 }],
  }));
  return (
    <Animated.View style={[styles.miniBubble, { left: x as `${number}%`, width: s, height: s, borderRadius: s / 2 }, anim]}>
      <Text style={{ fontSize: s * 0.45 }}>{e}</Text>
    </Animated.View>
  );
}

/** Four mini cards flipping in turn, one pair matching. */
function MemoryPreview({ active }: { active: boolean }) {
  const faces = ['🐻', '🐰', '🐻', '🐢'];
  return (
    <View style={styles.miniGrid}>
      {faces.map((f, i) => (
        <MiniCard key={i} face={f} delay={[0, 700, 350, 1050][i]} active={active} />
      ))}
    </View>
  );
}

function MiniCard({ face, delay, active }: { face: string; delay: number; active: boolean }) {
  const reduce = useReducedMotion();
  const f = useSharedValue(0);
  useEffect(() => {
    if (reduce || !active) return;
    f.value = 0;
    f.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 380, easing: Easing.out(Easing.back(1.4)) }), withDelay(1300, withTiming(0, { duration: 320 })), withDelay(800, withTiming(0, { duration: 0 }))),
        -1,
        false,
      ),
    );
  }, [active, delay, reduce, f]);
  const back = useAnimatedStyle(() => ({ opacity: f.value < 0.5 ? 1 : 0, transform: [{ perspective: 500 }, { rotateY: `${f.value * 180}deg` }] }));
  const front = useAnimatedStyle(() => ({ opacity: f.value >= 0.5 ? 1 : 0, transform: [{ perspective: 500 }, { rotateY: `${(f.value - 1) * 180}deg` }] }));
  return (
    <View style={styles.miniCard}>
      <Animated.View style={[styles.miniFace, styles.miniBack, back]} />
      <Animated.View style={[styles.miniFace, styles.miniFront, front]}>
        <Text style={{ fontSize: 22 }}>{face}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  title: { color: color.text, fontFamily: font.display, fontSize: 30, letterSpacing: -0.9 },
  card: { borderRadius: 24, backgroundColor: color.surface1, overflow: 'hidden' },
  stage: { height: 150, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 16 },
  cardTitle: { color: color.text, fontFamily: font.title, fontSize: 20 },
  cardSub: { color: color.text2, fontFamily: font.medium, fontSize: 13 },
  go: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  best: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: radius.pill, backgroundColor: color.surface2 },
  bestText: { color: color.text, fontFamily: font.mono, fontSize: 12 },
  miniBubble: { position: 'absolute', top: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(244,243,239,0.45)', backgroundColor: 'rgba(120,166,255,0.18)' },
  miniGrid: { flexDirection: 'row', gap: 10 },
  miniCard: { width: 52, height: 66 },
  miniFace: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', borderRadius: 10, alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden' },
  miniBack: { backgroundColor: color.surface2, borderWidth: 1, borderColor: color.line },
  miniFront: { backgroundColor: color.text },
});
