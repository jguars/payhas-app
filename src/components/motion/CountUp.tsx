import { useEffect, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

type Props = {
  value: number;
  format: (n: number) => string;
  /** Wait for the card to land before counting. */
  delay?: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** A number that counts up from zero once, after `delay`. */
export function CountUp({ value, format, delay = 0, duration = 900, style }: Props) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) return setShown(value);
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      setShown(Math.round(value * easeOutCubic(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => (raf = requestAnimationFrame(tick)), delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, delay, duration, reduce]);

  return <Text style={[style, { fontVariant: ['tabular-nums'] }]}>{format(shown)}</Text>;
}
