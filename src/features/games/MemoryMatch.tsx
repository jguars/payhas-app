import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { TimesUp } from '@/features/library/TimesUp';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { color, font, Lane, space } from '@/theme/tokens';

import { Confetti } from './Confetti';
import { Finish, GameBar, Readout } from './GameChrome';
import { CRITTERS, MEMORY, shuffle, useBest, useGameSession } from './shared';

const GAP = 10;
const PEEK_MS = 1400; // Little and Kids get a look at the board before it flips down
const MISS_MS = 750;

type Card = { id: number; symbol: string };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** One board of Memory Match. Remount (new key) to deal again. */
export function MemoryMatch({ lane, onAgain }: { lane: Lane; onAgain: () => void }) {
  const cfg = MEMORY[lane];
  const peek = lane === 'little' || lane === 'kids';
  const { lock } = useGameSession('memory');
  const best = useBest('memory', lane);
  const { t } = useT();

  const [deck] = useState<Card[]>(() => {
    const symbols = shuffle(CRITTERS).slice(0, cfg.pairs);
    return shuffle([...symbols, ...symbols]).map((symbol, id) => ({ id, symbol }));
  });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [missed, setMissed] = useState<number[]>([]);
  const [peeking, setPeeking] = useState(peek);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState<{ record: boolean } | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!peek) return;
    const t = setTimeout(() => setPeeking(false), 650 + PEEK_MS); // after the deal lands
    return () => clearTimeout(t);
  }, [peek]);

  useEffect(() => {
    if (!cfg.timed || done || peeking || lock) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [cfg.timed, done, peeking, lock]);

  const flip = (i: number) => {
    if (busy.current || peeking || done || open.includes(i) || matched.has(i)) return;
    const next = [...open, i];
    fx.flip();
    setOpen(next);
    if (next.length < 2) return;

    setMoves((m) => m + 1);
    const [a, b] = next;
    busy.current = true;
    if (deck[a].symbol === deck[b].symbol) {
      setTimeout(() => {
        const nowMatched = new Set(matched).add(a).add(b);
        if (nowMatched.size === deck.length) fx.win();
        else fx.match();
        setMatched(nowMatched);
        setOpen([]);
        busy.current = false;
        if (nowMatched.size === deck.length) {
          // Timed lanes compare time; untimed compare moves. Lower is better for both.
          setDone({ record: best.submit(cfg.timed ? seconds : moves + 1, true) });
        }
      }, 260);
    } else {
      setTimeout(fx.wrong, 260); // after the second card has turned
      setMissed(next);
      setTimeout(() => {
        setOpen([]);
        setMissed([]);
        busy.current = false;
      }, MISS_MS);
    }
  };

  // Fit the grid in the space under the top bar, cards at 4:5.
  const rows = Math.ceil(deck.length / cfg.cols);
  const availW = size.w - space.lg * 2;
  const availH = size.h - 150;
  const cardW = Math.max(0, Math.min((availW - GAP * (cfg.cols - 1)) / cfg.cols, ((availH - GAP * (rows - 1)) / rows) * 0.8, 150));
  const cardH = cardW * 1.25;
  const gridW = cardW * cfg.cols + GAP * (cfg.cols - 1);
  const gridH = cardH * rows + GAP * (rows - 1);

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GameBar>
        {cfg.timed && <Readout label={t('play.readout.time')} value={fmt(seconds)} />}
        {lane !== 'little' && <Readout label={t('play.readout.moves')} value={String(moves)} />}
        <Readout label={t('play.readout.pairs')} value={`${matched.size / 2}/${cfg.pairs}`} />
      </GameBar>

      {cardW > 0 && (
        <View style={[styles.grid, { width: gridW, height: gridH, marginTop: 40 }]}>
          {deck.map((c, i) => {
            const col = i % cfg.cols;
            const row = Math.floor(i / cfg.cols);
            return (
              <CardView
                key={c.id}
                card={c}
                index={i}
                w={cardW}
                h={cardH}
                x={col * (cardW + GAP)}
                y={row * (cardH + GAP)}
                fromX={gridW / 2 - cardW / 2}
                fromY={gridH / 2 - cardH / 2}
                faceUp={peeking || open.includes(i) || matched.has(i)}
                matched={matched.has(i)}
                missed={missed.includes(i)}
                onPress={() => flip(i)}
              />
            );
          })}
        </View>
      )}

      {done && (
        <>
          <Confetti x={size.w / 2} y={size.h * 0.4} count={44} spread={1.3} />
          <Finish
            title={t('play.foundAll')}
            lines={[
              cfg.timed
                ? `${fmt(seconds)} · ${t('play.moves', { count: moves })}`
                : lane === 'little'
                  ? t('play.everyPair')
                  : t('play.moves', { count: moves }),
            ]}
            record={done.record && lane !== 'little'}
            onAgain={onAgain}
          />
        </>
      )}
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

type CardProps = {
  card: Card;
  index: number;
  w: number;
  h: number;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  faceUp: boolean;
  matched: boolean;
  missed: boolean;
  onPress: () => void;
};

function CardView({ card, index, w, h, x, y, fromX, fromY, faceUp, matched, missed, onPress }: CardProps) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const deal = useSharedValue(reduce ? 1 : 0);
  const flip = useSharedValue(faceUp ? 1 : 0);
  const pop = useSharedValue(1);
  const shake = useSharedValue(0);

  // Dealt from the centre of the table, one after another.
  useEffect(() => {
    if (!reduce) deal.value = withDelay(index * 40, withSpring(1, spring.smooth));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    flip.value = reduce ? (faceUp ? 1 : 0) : withSpring(faceUp ? 1 : 0, { damping: 16, stiffness: 180 });
  }, [faceUp, reduce, flip]);

  useEffect(() => {
    if (matched && !reduce) pop.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, spring.bouncy));
  }, [matched, reduce, pop]);

  useEffect(() => {
    if (missed && !reduce) {
      shake.value = withDelay(
        260,
        withSequence(withTiming(-7, { duration: 50 }), withTiming(7, { duration: 70 }), withTiming(-4, { duration: 60 }), withSpring(0, spring.snappy)),
      );
    }
  }, [missed, reduce, shake]);

  const shell = useAnimatedStyle(() => ({
    opacity: Math.min(1, deal.value * 1.5),
    transform: [
      { translateX: fromX + (x - fromX) * deal.value + shake.value },
      { translateY: fromY + (y - fromY) * deal.value },
      { rotate: `${(1 - deal.value) * (index % 2 ? 12 : -12)}deg` },
      { scale: (0.6 + 0.4 * deal.value) * pop.value },
    ],
  }));
  // Two faces turning about Y; whichever is facing us is the one shown.
  const back = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 700 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
  }));
  const front = useAnimatedStyle(() => ({
    opacity: flip.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 700 }, { rotateY: `${interpolate(flip.value, [0, 1], [-180, 0])}deg` }],
  }));

  return (
    <Animated.View style={[styles.card, { width: w, height: h }, shell]}>
      <Pressable onPress={onPress} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={faceUp ? card.symbol : t('play.hiddenCard')}>
        <Animated.View style={[styles.face, styles.back, back]}>
          <View style={[styles.backMark, { width: w * 0.32, height: w * 0.32, borderRadius: w * 0.1 }]} />
        </Animated.View>
        <Animated.View style={[styles.face, styles.front, matched && styles.matched, front]}>
          <Text style={{ fontSize: w * 0.46 }}>{card.symbol}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  grid: { position: 'relative' },
  card: { position: 'absolute', left: 0, top: 0 },
  face: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', borderRadius: 16, alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden' },
  back: { backgroundColor: color.surface2, borderWidth: 1, borderColor: color.line },
  backMark: { backgroundColor: color.ember, opacity: 0.85, transform: [{ rotate: '45deg' }] },
  front: { backgroundColor: color.text, borderWidth: 2, borderColor: color.text },
  matched: { borderColor: color.success, backgroundColor: color.successSoft },
});

