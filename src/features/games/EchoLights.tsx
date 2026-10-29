import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Pop } from '@/components/motion/Pop';
import { TimesUp } from '@/features/library/TimesUp';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { alpha, color, Lane, lane as lanes, radius, space } from '@/theme/tokens';

import { Confetti } from './Confetti';
import { Finish, GameBar, Readout } from './GameChrome';
import { useBest, useGameSession } from './shared';
import type { GameMeta, GameProps } from './types';

/**
 * Per-lane tuning. `on`/`gap` are ms per light at the start; `ramp` shaves ms
 * off `on` for every step past the first, down to `minOn`. Little never loses:
 * a slip just replays the tune, and five lights in a row ends the round happily.
 */
const ECHO: Record<Lane, { pads: 4 | 6; start: number; on: number; gap: number; minOn: number; ramp: number; forgiving: boolean; goal: number | null }> = {
  little: { pads: 4, start: 1, on: 720, gap: 380, minOn: 720, ramp: 0, forgiving: true, goal: 5 },
  kids: { pads: 4, start: 1, on: 520, gap: 220, minOn: 520, ramp: 0, forgiving: false, goal: null },
  teen: { pads: 4, start: 2, on: 440, gap: 160, minOn: 220, ramp: 18, forgiving: false, goal: null },
  adult: { pads: 6, start: 2, on: 400, gap: 140, minOn: 180, ramp: 20, forgiving: false, goal: null },
};

/** Each light has its own colour, critter and sound, so it reads without colour vision and without looking. */
const PADS = [
  { tint: lanes.little.color, critter: '🐥', sound: fx.key },
  { tint: lanes.kids.color, critter: '🐸', sound: fx.tap },
  { tint: lanes.teen.color, critter: '🐳', sound: fx.flip },
  { tint: lanes.adult.color, critter: '🦄', sound: fx.pop },
  { tint: color.ember, critter: '🦊', sound: fx.like },
  { tint: color.text, critter: '🐼', sound: fx.save },
];

const LEDGE = 6;
const GAP = 14;

type Phase = 'ready' | 'show' | 'input' | 'cheer' | 'oops' | 'over' | 'won';

const randomPad = (n: number) => Math.floor(Math.random() * n);

/** One round of Echo Lights. Remount (new key) to restart. */
export function EchoLights({ lane, onAgain }: GameProps) {
  const cfg = ECHO[lane];
  const { lock } = useGameSession('echo');
  const best = useBest('echo', lane);
  const { t } = useT();
  const reduce = useReducedMotion();

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [seq, setSeq] = useState<number[]>(() => Array.from({ length: cfg.start }, () => randomPad(cfg.pads)));
  const [phase, setPhase] = useState<Phase>('ready');
  const [lit, setLit] = useState<number | null>(null);
  const [shown, setShown] = useState(-1); // index of the light being played back
  const [pos, setPos] = useState(0); // how far the player has got
  const [completed, setCompleted] = useState(0);
  const [cheer, setCheer] = useState(0);
  const [done, setDone] = useState<{ record: boolean } | null>(null);
  const [prevBest] = useState(() => best.read());

  const seqRef = useRef(seq);
  const posRef = useRef(0);
  const phaseRef = useRef<Phase>('ready');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shake = useSharedValue(0);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => clearTimers, []);
  useEffect(() => {
    if (lock) clearTimers();
  }, [lock]);

  /** Play the tune back, light by light, then hand over to the player. */
  const playback = (tune: number[], wait = 650) => {
    clearTimers();
    go('show');
    posRef.current = 0;
    setPos(0);
    setShown(-1);
    const on = Math.max(cfg.minOn, cfg.on - (tune.length - 1) * cfg.ramp);
    const gap = Math.max(90, Math.round((cfg.gap * on) / cfg.on));
    let at = wait;
    tune.forEach((p, i) => {
      later(at, () => {
        setLit(p);
        setShown(i);
        PADS[p].sound();
      });
      later(at + on, () => setLit(null));
      at += on + gap;
    });
    later(at, () => {
      setShown(-1);
      go('input');
    });
  };

  // Start once the board has a size.
  const started = useRef(false);
  useEffect(() => {
    if (size.w === 0 || started.current || lock) return;
    started.current = true;
    playback(seqRef.current, 900);
  }, [size.w, lock]); // eslint-disable-line react-hooks/exhaustive-deps

  const shakeBoard = (strength: number) => {
    if (reduce) return;
    shake.value = withSequence(
      withTiming(-strength, { duration: 50 }),
      withTiming(strength, { duration: 70 }),
      withTiming(-strength * 0.6, { duration: 60 }),
      withSpring(0, spring.snappy),
    );
  };

  const tap = (p: number) => {
    if (phaseRef.current !== 'input' || lock) return;
    const tune = seqRef.current;
    const want = tune[posRef.current];
    PADS[p].sound();

    if (p === want) {
      posRef.current += 1;
      setPos(posRef.current);
      if (posRef.current < tune.length) return;

      // The whole tune, right.
      const len = tune.length;
      setCompleted(len);
      if (cfg.goal != null && len >= cfg.goal) {
        go('won');
        later(260, () => {
          fx.win();
          setCheer((c) => c + 1);
        });
        later(900, () => setDone({ record: false }));
        return;
      }
      go('cheer');
      later(220, () => {
        if (len % 5 === 0) fx.combo();
        else fx.match();
        setCheer((c) => c + 1);
      });
      later(900, () => {
        const next = [...tune, randomPad(cfg.pads)];
        seqRef.current = next;
        setSeq(next);
        playback(next, 250);
      });
      return;
    }

    // A slip.
    if (cfg.forgiving) {
      // Little: a soft wobble, then the same tune again. Nothing lost.
      go('oops');
      later(120, fx.flip);
      shakeBoard(5);
      later(500, () => playback(tune, 400));
      return;
    }
    go('over');
    later(80, fx.wrong);
    shakeBoard(9);
    // Show which light it was, twice, before the card.
    [0, 1].forEach((k) => {
      later(420 + k * 380, () => setLit(want));
      later(420 + k * 380 + 220, () => setLit(null));
    });
    later(1400, () => {
      const score = completed;
      const record = score > 0 && best.submit(score);
      if (record) fx.win();
      setDone({ record });
    });
  };

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  // Pads: two across; as big as fits under the turn badge and the step dots.
  const rows = cfg.pads / 2;
  const availW = size.w - space.lg * 2 - GAP;
  const availH = size.h - 300;
  const padSize = Math.max(0, Math.min(availW / 2, (availH - GAP * (rows - 1)) / rows - LEDGE, 190));
  const boardW = padSize * 2 + GAP;

  const board = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const yourTurn = phase === 'input';
  const watching = phase === 'show' || phase === 'ready' || phase === 'oops';

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Glow />
      <GameBar>
        {lane !== 'little' && <Readout label={t('echo.readout.steps')} value={String(completed)} />}
        {lane !== 'little' && prevBest != null && <Readout label={t('echo.readout.best')} value={String(Math.max(prevBest, completed))} />}
      </GameBar>

      {padSize > 0 && (
        <View style={styles.stack}>
          <TurnBadge mode={yourTurn ? 'go' : watching ? 'watch' : 'cheer'} />
          <Dots count={seq.length} shown={shown} pos={pos} phase={phase} width={boardW} />
          <Animated.View style={[styles.board, { width: boardW }, board]}>
            {PADS.slice(0, cfg.pads).map((pad, i) => (
              <PadView
                key={i}
                index={i}
                tint={pad.tint}
                critter={pad.critter}
                size={padSize}
                lit={lit === i}
                cheer={cheer}
                enabled={yourTurn && !lock}
                onPress={tap}
              />
            ))}
          </Animated.View>
        </View>
      )}

      {done && (
        <>
          {(phase === 'won' || done.record) && <Confetti x={size.w / 2} y={size.h * 0.38} count={44} spread={1.3} />}
          <Finish
            title={phase === 'won' ? t('echo.littleWin') : completed >= 5 || done.record ? t('echo.great') : t('echo.close')}
            lines={[
              t('echo.steps', { count: completed }),
              ...(lane !== 'little' && prevBest != null && !done.record ? [t('play.best', { n: Math.max(prevBest, completed) })] : []),
            ]}
            record={done.record}
            onAgain={onAgain}
          />
        </>
      )}
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

/** Whose turn it is, as a picture: 👀 while the lights play, 👆 when it's yours. */
function TurnBadge({ mode }: { mode: 'watch' | 'go' | 'cheer' }) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const swap = useSharedValue(1);
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    swap.value = withSequence(withTiming(0.7, { duration: 90 }), withSpring(1, spring.bouncy));
    cancelAnimation(bob);
    bob.value = 0;
    if (mode === 'go') {
      // A little tapping finger.
      bob.value = withRepeat(withSequence(withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) })), -1, false);
    } else if (mode === 'watch') {
      // Eyes looking side to side.
      bob.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    }
  }, [mode, reduce, swap, bob]);

  const ring = useAnimatedStyle(() => ({ transform: [{ scale: swap.value }] }));
  const face = useAnimatedStyle(() =>
    mode === 'go' ? { transform: [{ translateY: bob.value * 7 }, { scale: 1 - bob.value * 0.06 }] } : { transform: [{ translateX: (bob.value - 0.5) * 10 }] },
  );
  const tint = mode === 'go' ? color.ember : mode === 'cheer' ? color.reward : color.line;

  return (
    <Animated.View
      style={[styles.badge, { borderColor: tint, backgroundColor: mode === 'watch' ? color.surface1 : alpha(tint, 0.16) }, ring]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={mode === 'go' ? t('echo.yourTurn') : t('echo.watch')}
    >
      <Animated.Text style={[styles.badgeEmoji, face]}>{mode === 'go' ? '👆' : mode === 'cheer' ? '🎉' : '👀'}</Animated.Text>
    </Animated.View>
  );
}

/** One dot per light in the tune: lit as it plays, filled as you copy it. */
function Dots({ count, shown, pos, phase, width }: { count: number; shown: number; pos: number; phase: Phase; width: number }) {
  const d = Math.max(8, Math.min(14, (width - (count - 1) * 6) / count));
  return (
    <View style={[styles.dots, { width, minHeight: d * 2 + 6 }]}>
      {Array.from({ length: count }, (_, i) => {
        const on = phase === 'show' ? i === shown : phase === 'cheer' || phase === 'won' ? true : i < pos;
        const tint = phase === 'cheer' || phase === 'won' ? color.reward : phase === 'show' ? color.text : color.ember;
        return (
          <Pop key={i} on={on} peak={1.5}>
            <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: on ? tint : color.surface2, borderWidth: 1, borderColor: on ? tint : color.line }} />
          </Pop>
        );
      })}
    </View>
  );
}

type PadProps = { index: number; tint: string; critter: string; size: number; lit: boolean; cheer: number; enabled: boolean; onPress: (i: number) => void };

function PadView({ index, tint, critter, size, lit, cheer, enabled, onPress }: PadProps) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const enter = useSharedValue(reduce ? 1 : 0);
  const glow = useSharedValue(0);
  const press = useSharedValue(0);
  const bump = useSharedValue(1);

  useEffect(() => {
    if (!reduce) enter.value = withDelay(120 + index * 70, withSpring(1, spring.bouncy));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    glow.value = lit ? withTiming(1, { duration: 70 }) : withTiming(0, { duration: 260 });
    if (lit && !reduce) bump.value = withSequence(withTiming(1.07, { duration: 90 }), withSpring(1, spring.bouncy));
  }, [lit, reduce, glow, bump]);

  // A ripple of bounces across the board when a tune is copied right.
  useEffect(() => {
    if (cheer === 0) return;
    glow.set(withDelay(index * 60, withSequence(withTiming(0.8, { duration: 90 }), withTiming(0, { duration: 380 }))));
    if (!reduce) bump.set(withDelay(index * 60, withSequence(withTiming(1.1, { duration: 110 }), withSpring(1, spring.bouncy))));
  }, [cheer, index, reduce, glow, bump]);

  const shell = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.4),
    transform: [{ translateY: (1 - enter.value) * 40 }, { scale: (0.6 + 0.4 * enter.value) * bump.value }],
  }));
  const halo = useAnimatedStyle(() => {
    const v = Math.max(glow.value, press.value);
    return { opacity: v, transform: [{ scale: 1 + 0.16 * v }] };
  });
  const halo2 = useAnimatedStyle(() => {
    const v = Math.max(glow.value, press.value);
    return { opacity: v * 0.6, transform: [{ scale: 1.1 + 0.26 * v }] };
  });
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * LEDGE * 0.8 }] }));
  const dim = useAnimatedStyle(() => ({ opacity: 0.58 * (1 - Math.max(glow.value, press.value)) }));
  const pal = useAnimatedStyle(() => {
    const v = Math.max(glow.value, press.value);
    return { transform: [{ scale: 1 + 0.22 * v }, { rotate: `${(index % 2 ? -8 : 8) * v}deg` }] };
  });

  const r = Math.min(radius.video, size * 0.24);
  return (
    <Animated.View style={[{ width: size, height: size + LEDGE }, shell]}>
      <Animated.View pointerEvents="none" style={[styles.halo, { width: size, height: size, borderRadius: r, backgroundColor: alpha(tint, 0.28) }, halo2]} />
      <Animated.View pointerEvents="none" style={[styles.halo, { width: size, height: size, borderRadius: r, backgroundColor: alpha(tint, 0.5) }, halo]} />
      <View style={[styles.ledge, { width: size, height: size, borderRadius: r, backgroundColor: shade(tint) }]} />
      <Pressable
        onPressIn={() => {
          if (!enabled) return;
          press.value = withTiming(1, { duration: 60 });
          onPress(index);
        }}
        onPressOut={() => (press.value = withTiming(0, { duration: 240 }))}
        accessibilityRole="button"
        accessibilityLabel={t('echo.pad', { symbol: critter })}
        accessibilityState={{ disabled: !enabled }}
        style={{ width: size, height: size }}
      >
        <Animated.View style={[styles.pad, { width: size, height: size, borderRadius: r, backgroundColor: tint }, face]}>
          <View style={[styles.glint, { width: size * 0.3, height: size * 0.1, borderRadius: size, top: size * 0.1, left: size * 0.12 }]} />
          <Animated.Text style={[{ fontSize: size * 0.42 }, pal]}>{critter}</Animated.Text>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: r, backgroundColor: color.ink }, dim]} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** A slow dim light behind the board so the screen breathes between tunes. */
function Glow() {
  const reduce = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!reduce) v.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, v]);
  const anim = useAnimatedStyle(() => ({ opacity: 0.6 + 0.4 * v.value, transform: [{ scale: 1 + 0.12 * v.value }] }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <Animated.View style={[styles.ambient, anim]} />
    </View>
  );
}

/** A darker edge of the same colour for the ledge (same rule as Chip). */
function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const k = 0.62;
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ── Play-tab card ────────────────────────────────────────────────────────────

/** A little console of four lights playing a tune, then copying it back. */
function EchoScene({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [lit, setLit] = useState<number | null>(reduce ? 2 : null);
  useEffect(() => {
    if (reduce || !active) return;
    const tune = [0, 2, 3, 1, -1, 0, 2, 3, 1, -1, -1];
    let i = 0;
    const id = setInterval(() => {
      const p = tune[i % tune.length];
      setLit(p < 0 ? null : p);
      i += 1;
    }, 420);
    return () => {
      clearInterval(id);
      setLit(null);
    };
  }, [active, reduce]);
  return (
    <View style={styles.console}>
      {PADS.slice(0, 4).map((p, i) => (
        <MiniPad key={i} tint={p.tint} critter={p.critter} lit={lit === i} />
      ))}
    </View>
  );
}

function MiniPad({ tint, critter, lit }: { tint: string; critter: string; lit: boolean }) {
  const v = useSharedValue(lit ? 1 : 0);
  useEffect(() => {
    v.value = lit ? withTiming(1, { duration: 70 }) : withTiming(0, { duration: 260 });
  }, [lit, v]);
  const halo = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 1 + 0.3 * v.value }] }));
  const face = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * v.value }] }));
  const dim = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - v.value) }));
  return (
    <View style={styles.miniCell}>
      <Animated.View style={[styles.miniHalo, { backgroundColor: alpha(tint, 0.5) }, halo]} />
      <Animated.View style={[styles.miniPad, { backgroundColor: tint }, face]}>
        <Text style={styles.miniCritter}>{critter}</Text>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 10, backgroundColor: color.ink }, dim]} />
      </Animated.View>
    </View>
  );
}

const ECHO_STARS: Record<Lane, [number, number, number]> = {
  little: [3, 4, 5],
  kids: [4, 7, 10],
  teen: [6, 9, 13],
  adult: [6, 9, 13],
};

export const echoLightsMeta: GameMeta = {
  id: 'echo',
  name: 'echo.name',
  sub: (lane, t) => t(lane === 'little' ? 'echo.sub.little' : lane === 'kids' ? 'echo.sub.kids' : ECHO[lane].pads === 6 ? 'echo.sub.six' : 'echo.sub.fast'),
  tint: lanes.little.color,
  Scene: EchoScene,
  best: {
    format: (n, _lane, t) => t('echo.steps', { count: n }),
    stars: (n, lane) => {
      const [, two, three] = ECHO_STARS[lane];
      return n >= three ? 3 : n >= two ? 2 : 1;
    },
    hiddenFor: ['little'],
  },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stack: { alignItems: 'center', gap: space.lg, marginTop: 56 },
  ambient: { width: 420, height: 420, borderRadius: 210, backgroundColor: alpha(lanes.adult.color, 0.07) },
  badge: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeEmoji: { fontSize: 40 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 6 },
  board: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginTop: space.sm },
  halo: { position: 'absolute', left: 0, top: 0 },
  ledge: { position: 'absolute', left: 0, top: LEDGE },
  pad: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.ink, overflow: 'hidden' },
  glint: { position: 'absolute', backgroundColor: alpha(color.white, 0.45), transform: [{ rotate: '-18deg' }] },
  console: { flexDirection: 'row', flexWrap: 'wrap', width: 100, gap: 8, padding: 8, borderRadius: radius.card, backgroundColor: color.ink, borderWidth: 2, borderColor: color.ink },
  miniCell: { width: 36, height: 36 },
  miniHalo: { position: 'absolute', left: 0, top: 0, width: 36, height: 36, borderRadius: 10 },
  miniPad: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  miniCritter: { fontSize: 18 },
});
