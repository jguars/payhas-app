import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { color, font, space, themedStyles } from '@/theme/tokens';

type Props = {
  title: string;
  /** Return false for a wrong PIN, or a string to show as the error. */
  onComplete: (pin: string) => Promise<boolean | string>;
  onCancel?: () => void;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export function PinPad({ title, onComplete, onCancel }: Props) {
  const { t } = useT();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = async (key: string) => {
    if (busy || !key) return;
    fx.key();
    if (key === '⌫') return setPin((p) => p.slice(0, -1));
    const next = pin + key;
    setError(null);
    setPin(next);
    if (next.length < 4) return;
    setBusy(true);
    try {
      const result = await onComplete(next);
      if (result === true) fx.success();
      else fx.error();
      if (result !== true) {
        setError(typeof result === 'string' ? result : t('auth.pin.wrong'));
        setPin('');
      }
    } catch (e) {
      fx.error();
      setError(e instanceof Error ? e.message : t('auth.pin.error'));
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.dots} accessibilityLabel={t('auth.pin.progress', { n: pin.length })}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
        ))}
      </View>
      <Text style={styles.error}>{error ?? ' '}</Text>
      <View style={styles.grid}>
        {KEYS.map((k, i) => (
          <Pressable
            key={i}
            onPress={() => press(k)}
            disabled={!k}
            accessibilityRole="button"
            accessibilityLabel={k === '⌫' ? t('auth.pin.delete') : k}
            style={({ pressed }) => [styles.key, !k && styles.keyEmpty, pressed && styles.keyPressed]}
          >
            <Text style={styles.keyText}>{k}</Text>
          </Pressable>
        ))}
      </View>
      {onCancel && (
        <Pressable onPress={onCancel} hitSlop={10} style={styles.cancel}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { alignItems: 'center', gap: space.lg },
  title: { color: color.text, fontFamily: font.title, fontSize: 22 },
  dots: { flexDirection: 'row', gap: space.lg },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: color.text3 },
  dotOn: { backgroundColor: color.text, borderColor: color.text },
  error: { color: color.ember, fontFamily: font.semibold, fontSize: 14 },
  grid: { width: 264, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  key: { width: 76, height: 64, borderRadius: 20, backgroundColor: color.surface1, alignItems: 'center', justifyContent: 'center' },
  keyEmpty: { backgroundColor: 'transparent' },
  keyPressed: { backgroundColor: color.surface2 },
  keyText: { color: color.text, fontFamily: font.semibold, fontSize: 24 },
  cancel: { paddingVertical: space.sm },
  cancelText: { color: color.text2, fontFamily: font.semibold, fontSize: 15 },
}));
