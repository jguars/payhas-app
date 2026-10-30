import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { StatusScrim } from '@/components/StatusScrim';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useFamily } from '@/features/family/FamilyProvider';
import { GAMES, SECTIONS } from '@/features/games/catalog';
import { useBest } from '@/features/games/shared';
import type { GameMeta } from '@/features/games/types';
import { TimesUp } from '@/features/library/TimesUp';
import type { GameId } from '@/features/library/LibraryProvider';
import { useScreenTime } from '@/features/library/useScreenTime';
import { useProfilePlan } from '@/features/plan/usePlan';
import { useT } from '@/i18n';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';
import { alpha, color, font, iconSize, iconStroke, Lane, layout, pageFill, radius, space, themedStyles, type } from '@/theme/tokens';

/** Sections shown as a grid; the rest are horizontal shelves (approved at Gate 2). */
const GRID_SECTIONS = ['play.section.brain'];
const SHELF_TILE = 148;
const HERO_STAGE = 184;
const GRID_STAGE = 104;

/**
 * Play: one featured game with the screen's only ember button, then shelves
 * of quick games and a grid of brain games. Every tile is a tactile Card; a
 * locked game says "Ask a parent" — never a price.
 */
export default function PlayScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const { width } = useWindowDimensions();
  const { current } = useFamily();
  const { lock, todaySeconds, limitMinutes } = useScreenTime({ games: true });
  const { gameOpen } = useProfilePlan();
  const [lockedOpen, setLockedOpen] = useState(false);
  // Read once per visit: the featured game changes each day among the open quick games.
  const [day] = useState(() => Math.floor(Date.now() / 86_400_000));
  const { t } = useT();
  if (!current) return <View style={styles.root} />;
  const lane = current.lane;
  const todayMin = Math.floor(todaySeconds / 60);
  const contentW = Math.min(width, 560) - layout.gutter * 2;
  const gridW = (contentW - space.md) / 2;

  const quick = SECTIONS[0].games.filter((id) => gameOpen(id));
  const featured: GameId | undefined = quick[day % Math.max(1, quick.length)];
  const open = (id: GameId) => {
    if (!gameOpen(id)) return setLockedOpen(true);
    router.push(`/games/${id}`);
  };
  let order = 2; // running index so sections cascade in down the page

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: barSpace }]} showsVerticalScrollIndicator={false}>
        <Enter index={0} style={styles.head}>
          <PageHeader
            title={t('play.title')}
            subtitle={limitMinutes != null ? t('play.leftToday', { n: Math.max(0, limitMinutes - todayMin) }) : t('play.playedToday', { n: todayMin })}
          />
          {limitMinutes != null && limitMinutes > 0 && <ProgressBar progress={todayMin / limitMinutes} label={t('play.leftToday', { n: Math.max(0, limitMinutes - todayMin) })} />}
        </Enter>

        {featured && (
          <Enter index={1}>
            <Featured meta={GAMES[featured].meta} lane={lane} focused={focused} onPlay={() => open(featured)} />
          </Enter>
        )}

        {SECTIONS.map((section) => {
          // Open games first, locked ones after: a child shouldn't meet a wall of locks.
          const games = section.games.filter((id) => id !== featured).sort((a, b) => Number(!gameOpen(a)) - Number(!gameOpen(b)));
          if (games.length === 0) return null;
          const grid = GRID_SECTIONS.includes(section.title);
          return (
            <Enter key={section.title} index={order++} style={styles.section}>
              <SectionHeader title={t(section.title)} />
              {grid ? (
                <View style={styles.grid}>
                  {games.map((id) => (
                    <View key={id} style={{ width: gridW }}>
                      <GridTile meta={GAMES[id].meta} lane={lane} focused={focused} locked={!gameOpen(id)} onPress={() => open(id)} />
                    </View>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shelfScroll} contentContainerStyle={styles.shelf}>
                  {games.map((id) => (
                    <ShelfTile key={id} meta={GAMES[id].meta} lane={lane} focused={focused} locked={!gameOpen(id)} onPress={() => open(id)} />
                  ))}
                </ScrollView>
              )}
            </Enter>
          );
        })}
      </ScrollView>
      <StatusScrim />
      {/* Free plan: a locked game says "ask a parent" — never a price, never a way to pay. */}
      <BottomSheet open={lockedOpen} onClose={() => setLockedOpen(false)} title={t('plus.gameLockedTitle')}>
        <EmptyState icon="lock" title={t('play.askParent')} body={t('plus.gameLockedSub')} />
      </BottomSheet>
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

/** The game's animated scene on its own colour; dimmed with a lock when it isn't open. */
function Stage({ meta, active, locked, height }: { meta: GameMeta; active: boolean; locked: boolean; height: number }) {
  const { Scene } = meta;
  return (
    // Decorative scene: the tile around it carries the name for screen readers.
    <View style={[styles.stage, { height, backgroundColor: meta.tint }]} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
      <Scene active={active && !locked} />
      {locked && (
        <View style={styles.lockScrim}>
          <View style={styles.lockBadge}>
            <Icon name="lock" size={iconSize.md} color={color.text} strokeWidth={iconStroke(iconSize.md)} />
          </View>
        </View>
      )}
    </View>
  );
}

function Featured({ meta, lane, focused, onPlay }: { meta: GameMeta; lane: Lane; focused: boolean; onPlay: () => void }) {
  const { t } = useT();
  const name = t(meta.name);
  return (
    <Card hero tactile flush>
      {/* The art is a big tap target for small hands; screen readers get the one Play button instead. */}
      <Pressable onPress={onPlay} accessible={false} importantForAccessibility="no-hide-descendants">
        <Stage meta={meta} active={focused} locked={false} height={HERO_STAGE} />
      </Pressable>
      <View style={styles.heroFoot}>
        <View style={styles.grow}>
          <Text style={styles.heroName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.sub} numberOfLines={2}>
            {meta.sub(lane, t)}
          </Text>
        </View>
        <Button label={t('play.play')} accessibilityLabel={`${t('play.play')}: ${name}`} size="sm" block={false} onPress={onPlay} />
      </View>
    </Card>
  );
}

function ShelfTile({ meta, lane, focused, locked, onPress }: { meta: GameMeta; lane: Lane; focused: boolean; locked: boolean; onPress: () => void }) {
  const { t } = useT();
  const name = t(meta.name);
  return (
    <View style={styles.shelfTile}>
      <Card tactile flush onPress={onPress} accessibilityLabel={locked ? `${name}. ${t('play.askParent')}` : name}>
        <Stage meta={meta} active={focused} locked={locked} height={SHELF_TILE} />
      </Card>
      <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {name}
      </Text>
      {locked ? <Badge label={t('play.askParent')} icon="lock" /> : <Best meta={meta} lane={lane} focused={focused} fallback={meta.sub(lane, t)} />}
    </View>
  );
}

function GridTile({ meta, lane, focused, locked, onPress }: { meta: GameMeta; lane: Lane; focused: boolean; locked: boolean; onPress: () => void }) {
  const { t } = useT();
  const name = t(meta.name);
  const sub = meta.sub(lane, t);
  return (
    <Card tactile flush onPress={onPress} accessibilityLabel={locked ? `${name}. ${t('play.askParent')}` : `${name}. ${sub}`}>
      <Stage meta={meta} active={focused} locked={locked} height={GRID_STAGE} />
      <View style={styles.gridFoot}>
        <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {name}
        </Text>
        <Text style={styles.sub} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {sub}
        </Text>
        {locked ? <Badge label={t('play.askParent')} icon="lock" /> : <Best meta={meta} lane={lane} focused={focused} />}
      </View>
    </Card>
  );
}

/** Best score as three stars and the score in words; the fallback line until there is one. */
function Best({ meta, lane, focused, fallback }: { meta: GameMeta; lane: Lane; focused: boolean; fallback?: string }) {
  const { t } = useT();
  const { read } = useBest(meta.id, lane);
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    if (focused) setValue(read()); // re-read after coming back from a game
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps
  if (value == null || !meta.best || meta.best.hiddenFor?.includes(lane)) {
    return fallback ? (
      <Text style={styles.sub} numberOfLines={1}>
        {fallback}
      </Text>
    ) : null;
  }
  const earned = meta.best.stars(value, lane);
  const label = meta.best.format(value, lane, t);
  return (
    <View style={styles.best} accessibilityLabel={label}>
      {[0, 1, 2].map((i) => (
        <Icon key={i} name="star" size={iconSize.sm} color={i < earned ? color.reward : color.line} filled />
      ))}
      <Text style={styles.bestText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  content: { paddingHorizontal: layout.gutter, gap: layout.section, alignSelf: 'center', width: '100%', maxWidth: 560 },
  head: { gap: space.md },
  section: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  shelfScroll: { marginHorizontal: -layout.gutter },
  shelf: { gap: space.md, paddingHorizontal: layout.gutter },
  shelfTile: { width: SHELF_TILE, gap: space.xs },
  stage: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  gridFoot: { padding: space.md, gap: space.xs },
  grow: { flex: 1, gap: space.xs },
  heroName: { color: color.text, fontFamily: font.title, ...type.title },
  name: { color: color.text, fontFamily: font.title, ...type.lead },
  sub: { color: color.text2, fontFamily: font.medium, ...type.small },
  best: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  bestText: { flexShrink: 1, color: color.text2, fontFamily: font.semibold, ...type.caption },
  lockScrim: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(color.ink, 0.5) },
  lockBadge: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface2 },
}));
