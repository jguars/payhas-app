import { router } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGoBack } from '@/lib/useGoBack';
import { useInsets } from '@/lib/useInsets';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { useT } from '@/i18n';
import { color, font, radius, space } from '@/theme/tokens';

/** Top bar shared by the games: close on the left, the game's readouts on the right. */
export function GameBar({ children }: { children?: ReactNode }) {
  const goBack = useGoBack();
  const insets = useInsets();
  const { t } = useT();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <PressScale onPress={() => goBack()} pressedScale={0.88} accessibilityRole="button" accessibilityLabel={t('play.closeGame')} style={styles.close}>
        <Icon name="close" size={18} strokeWidth={2.6} />
      </PressScale>
      <View style={styles.readouts}>{children}</View>
    </View>
  );
}

export function Readout({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.readout} accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.readoutValue}>{value}</Text>
      <Text style={styles.readoutLabel}>{label}</Text>
    </View>
  );
}

/** End-of-round card. */
export function Finish({ title, lines, record, onAgain }: { title: string; lines: string[]; record: boolean; onAgain: () => void }) {
  const goBack = useGoBack();
  const { t } = useT();
  return (
    <View style={styles.finish}>
      <Enter index={0}>
        <Text style={styles.finishTitle}>{title}</Text>
      </Enter>
      {record && (
        <Enter index={1} style={styles.record}>
          <Icon name="star" size={16} color={color.ink} filled />
          <Text style={styles.recordText}>{t('play.newBest')}</Text>
        </Enter>
      )}
      {lines.map((l, i) => (
        <Enter key={l} index={2 + i}>
          <Text style={styles.finishLine}>{l}</Text>
        </Enter>
      ))}
      <Enter index={2 + lines.length} style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
        <PressScale onPress={() => goBack()} accessibilityRole="button" style={[styles.button, styles.secondary]}>
          <Text style={[styles.buttonText, { color: color.text }]}>{t('common.done')}</Text>
        </PressScale>
        <PressScale onPress={onAgain} accessibilityRole="button" style={styles.button}>
          <Text style={styles.buttonText}>{t('play.playAgain')}</Text>
        </PressScale>
      </Enter>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(20,20,27,0.7)', alignItems: 'center', justifyContent: 'center' },
  readouts: { flexDirection: 'row', gap: space.sm },
  readout: { minWidth: 64, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(20,20,27,0.7)', alignItems: 'center' },
  readoutValue: { color: color.text, fontFamily: font.mono, fontSize: 18, fontVariant: ['tabular-nums'] },
  readoutLabel: { color: color.text3, fontFamily: font.semibold, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  finish: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: 'rgba(10,10,15,0.82)', padding: space.xl },
  finishTitle: { color: color.text, fontFamily: font.display, fontSize: 34, letterSpacing: -0.8, textAlign: 'center' },
  record: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFD25E', paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  recordText: { color: color.ink, fontFamily: font.bold, fontSize: 13 },
  finishLine: { color: color.text2, fontFamily: font.medium, fontSize: 16, textAlign: 'center' },
  button: { height: 50, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: color.ember, justifyContent: 'center' },
  secondary: { backgroundColor: color.surface2 },
  buttonText: { color: color.ink, fontFamily: font.bold, fontSize: 16 },
});
