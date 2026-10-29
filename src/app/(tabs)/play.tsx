import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { StatusScrim } from '@/components/StatusScrim';
import { useFamily } from '@/features/family/FamilyProvider';
import { GAMES, SECTIONS } from '@/features/games/catalog';
import { useBest } from '@/features/games/shared';
import type { GameMeta } from '@/features/games/types';
import { TimesUp } from '@/features/library/TimesUp';
import { useScreenTime } from '@/features/library/useScreenTime';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { color, font, Lane, radius, space } from '@/theme/tokens';

const LEDGE = 5;
const GAP = space.md;
const STAGE_H = 112;

export default function PlayScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const { width } = useWindowDimensions();
  const { current } = useFamily();
  const { lock, todaySeconds, limitMinutes } = useScreenTime({ games: true });
  const { t } = useT();
  if (!current) return <View style={styles.root} />;
  const lane = current.lane;
  const todayMin = Math.floor(todaySeconds / 60);
  const tileW = (Math.min(width, 560) - space.lg * 2 - GAP) / 2;
  const total = SECTIONS.reduce((n, s) => n + s.games.length, 0);
  let order = 1; // running index so the tiles cascade in down the whole page

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: barSpace }]} showsVerticalScrollIndicator={false}>
        <Enter index={0} style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            {t('play.title')}
          </Text>
          <View style={styles.meta}>
            <View style={styles.today}>
              <Icon name="clock" size={14} color={color.text2} strokeWidth={2.4} />
              <Text style={styles.todayText}>{limitMinutes != null ? t('play.todayOf', { used: todayMin, limit: limitMinutes }) : t('play.today', { n: todayMin })}</Text>
            </View>
            <Text style={styles.count}>{t('play.games', { count: total })}</Text>
          </View>
        </Enter>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Enter index={order++}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {t(section.title)}
              </Text>
            </Enter>
            <View style={styles.grid}>
              {section.games.map((id) => (
                <Enter key={id} index={order++} style={{ width: tileW }}>
                  <GameTile meta={GAMES[id].meta} lane={lane} focused={focused} />
                </Enter>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <StatusScrim />
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

/**
 * A tactile game tile: an animated stage in the game's colour, the name, one
 * lane-tuned line and the best score as stars. The whole tile presses down
 * into its ledge — there's no separate button, so ten games don't mean ten
 * competing call-to-actions.
 */
function GameTile({ meta, lane, focused }: { meta: GameMeta; lane: Lane; focused: boolean }) {
  const { t } = useT();
  const press = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * LEDGE }] }));
  const name = t(meta.name);
  const sub = meta.sub(lane, t);
  const { Scene } = meta;
  return (
    <Pressable
      onPress={() => {
        fx.tap();
        router.push(`/games/${meta.id}`);
      }}
      onPressIn={() => (press.value = withSpring(1, spring.snappy))}
      onPressOut={() => (press.value = withSpring(0, spring.bouncy))}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${sub}`}
      style={{ paddingBottom: LEDGE }}
    >
      <View style={[styles.ledge, { backgroundColor: shade(meta.tint) }]} />
      <Animated.View style={[styles.tile, anim]}>
        <View style={[styles.stage, { backgroundColor: meta.tint }]}>
          <Scene active={focused} />
        </View>
        <View style={styles.foot}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {name}
          </Text>
          <Text style={styles.sub} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {sub}
          </Text>
          {meta.best && !meta.best.hiddenFor?.includes(lane) && <Best meta={meta} lane={lane} focused={focused} />}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** Best score as a three-star row plus the number itself; nothing until there's a score. */
function Best({ meta, lane, focused }: { meta: GameMeta; lane: Lane; focused: boolean }) {
  const { t } = useT();
  const { read } = useBest(meta.id, lane);
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    if (focused) setValue(read()); // re-read after coming back from a game
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps
  if (value == null || !meta.best) return null;
  const earned = meta.best.stars(value, lane);
  const label = meta.best.format(value, lane, t);
  return (
    <View style={styles.best} accessibilityLabel={label}>
      <View style={styles.stars}>
        {[0, 1, 2].map((i) => (
          <Icon key={i} name="star" size={13} color={i < earned ? color.reward : color.line} filled />
        ))}
      </View>
      <Text style={styles.bestText} numberOfLines={1}>
        {label}
      </Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  content: { paddingHorizontal: space.lg, gap: space.xl, alignSelf: 'center', width: '100%', maxWidth: 560 },
  head: { gap: space.sm },
  title: { color: color.text, fontFamily: font.display, fontSize: 30, letterSpacing: -0.9 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  today: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayText: { color: color.text2, fontFamily: font.mono, fontSize: 13 },
  count: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  section: { gap: space.md },
  sectionTitle: { color: color.text, fontFamily: font.title, fontSize: 20, letterSpacing: -0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  ledge: { position: 'absolute', left: 0, right: 0, top: LEDGE, bottom: 0, borderRadius: radius.card },
  tile: { borderRadius: radius.card, borderWidth: 2, borderColor: color.ink, backgroundColor: color.surface1, overflow: 'hidden' },
  stage: { height: STAGE_H, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: color.ink },
  foot: { padding: 12, gap: 3, minHeight: 92 },
  name: { color: color.text, fontFamily: font.title, fontSize: 17, letterSpacing: -0.3 },
  sub: { color: color.text2, fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  best: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  stars: { flexDirection: 'row', gap: 1 },
  bestText: { flexShrink: 1, color: color.text, fontFamily: font.mono, fontSize: 12 },
});
