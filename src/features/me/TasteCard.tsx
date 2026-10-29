import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { CountUp } from '@/components/motion/CountUp';
import { PressScale } from '@/components/motion/PressScale';
import { topicLabel, useT } from '@/i18n';
import { spring, stagger } from '@/theme/motion';
import { color, font, radius, space, themedStyles } from '@/theme/tokens';

import { tasteRows, TasteRow } from './useMe';

type Props = { taste: TasteRow[]; onReset: () => void; delay?: number };

/** "Your taste": each bar grows from the left in turn, then its percentage counts. */
export function TasteCard({ taste, onReset, delay = 0 }: Props) {
  const { t } = useT();
  const rows = tasteRows(taste);
  const empty = rows.every((r) => r.share === 0);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={[styles.title, { flexShrink: 1 }]} numberOfLines={1}>{t('me.taste.title')}</Text>
        {!empty && (
          <PressScale onPress={onReset} pressedScale={0.92} hitSlop={8} accessibilityRole="button" style={styles.reset}>
            <Text style={styles.resetText}>{t('me.taste.reset')}</Text>
          </PressScale>
        )}
      </View>
      {empty ? (
        <Text style={styles.hint}>{t('me.taste.empty')}</Text>
      ) : (
        <View style={{ gap: space.md }}>
          {rows.map((r, i) => (
            <Bar key={r.slug} row={r} delay={delay + stagger(i, 90)} />
          ))}
        </View>
      )}
    </View>
  );
}

function Bar({ row, delay }: { row: TasteRow & { exploring: boolean }; delay: number }) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const pct = Math.round(row.share * 100);
  // A floor so "exploring" topics with no watch time still show a sliver.
  const target = Math.max(0.04, row.share);
  const fill = useSharedValue(reduce ? target : 0);

  useEffect(() => {
    fill.value = reduce ? target : withDelay(delay, withSpring(target, spring.smooth));
    return () => {
      fill.value = withTiming(0, { duration: 160 });
    };
  }, [target, delay, reduce, fill]);

  // scaleX, not width: transform stays on the compositor.
  const anim = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0, fill.value) }] }));
  const tint = row.exploring ? color.info : color.ember;

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.rowHead}>
        <Text style={[styles.label, row.exploring && { color: color.text2 }]}>
          {topicLabel(t, row.slug, row.label)}
          {row.exploring && <Text style={styles.exploring}> · {t('me.taste.exploring')}</Text>}
        </Text>
        <CountUp value={pct} format={(n) => `${n}%`} delay={delay + 200} duration={700} style={styles.pct} />
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: tint }, anim]} />
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  card: { backgroundColor: color.surface1, borderRadius: 24, padding: 18, gap: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 },
  title: { color: color.text, fontFamily: font.title, fontSize: 19 },
  reset: { minHeight: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, justifyContent: 'center' },
  resetText: { color: color.text2, fontFamily: font.semibold, fontSize: 12 },
  hint: { color: color.text3, fontFamily: font.medium, fontSize: 14 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: color.text, fontFamily: font.semibold, fontSize: 14 },
  exploring: { fontFamily: font.medium, fontSize: 12 },
  pct: { color: color.text2, fontFamily: font.mono, fontSize: 12 },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: color.line, overflow: 'hidden' },
  fill: { height: 6, width: '100%', borderRadius: radius.pill, transformOrigin: 'left' },
}));
