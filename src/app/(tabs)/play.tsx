import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { StatusScrim } from '@/components/StatusScrim';
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
import type { GameId } from '@/features/library/LibraryProvider';
import { TimesUp } from '@/features/library/TimesUp';
import { useScreenTime } from '@/features/library/useScreenTime';
import { useProfilePlan } from '@/features/plan/usePlan';
import { useT } from '@/i18n';
import { durationWords } from '@/i18n/format';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';
import { color, control, font, iconSize, iconStroke, Lane, layout, leading, pageFill, radius, space, themedStyles, type } from '@/theme/tokens';

/** Sections shown as a grid; sections with fewer than four games are grids too (decided on the whole section, so the featured rotation never changes the layout). */
const GRID_SECTIONS = ['play.section.brain'];
/** How long game scenes play on each visit before they hold still. */
const SCENE_MS = 6000;
const SHELF_TILE = 148;
const HERO_STAGE = 200;
const GRID_STAGE = 104;

const localDay = () => {
  const d = new Date();
  return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
};

/**
 * Play: one featured game with the screen's only ember button, then shelves
 * of quick games and a grid of brain games. Children only see games they can
 * play — on Free the rest fold into one quiet "More games" tile that never
 * shows a lock wall or a price (owner decision, review panel 2026-10-30).
 */
export default function PlayScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const { width } = useWindowDimensions();
  const { current } = useFamily();
  const { lock, todaySeconds, limitMinutes } = useScreenTime({ games: true });
  const { gameOpen, loaded, failed, reload } = useProfilePlan();
  const [moreOpen, setMoreOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // Re-read on every visit, on the phone's own calendar: the featured game changes each local day.
  const [day, setDay] = useState(localDay);
  // Every visit: today's featured game, and the plan again (a Plus upgrade shows up at once).
  useFocusEffect(
    useCallback(() => {
      setDay(localDay());
      reload();
    }, [reload]),
  );
  // Scenes play for a few seconds on each visit, then hold still (WCAG 2.2.2: nothing moves on its own for long).
  const [live, setLive] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setLive(true);
      const id = setTimeout(() => setLive(false), SCENE_MS);
      return () => clearTimeout(id);
    }, []),
  );
  const { t } = useT();
  if (!current) return <View style={styles.root} />;
  const lane = current.lane;
  const contentW = Math.min(width, layout.maxContent) - layout.gutter * 2;
  const gridW = (contentW - space.md) / 2;
  const leftS = limitMinutes != null ? Math.max(0, limitMinutes * 60 - todaySeconds) : null;
  const subtitle =
    limitMinutes === 0 ? t('play.noTimeToday') : leftS != null ? t('play.leftToday', { time: durationWords(t, leftS) }) : t('play.playedToday', { time: durationWords(t, todaySeconds) });

  const sections = SECTIONS.map((s) => ({ ...s, games: s.games.filter((id) => gameOpen(id)) }));
  const hidden = loaded && SECTIONS.some((s) => s.games.some((id) => !gameOpen(id)));
  const pool = sections[0].games.length > 0 ? sections[0].games : sections.flatMap((s) => s.games);
  const featured: GameId | undefined = pool[day % Math.max(1, pool.length)];
  const play = (id: GameId) => router.push(`/games/${id}`);
  let order = 2; // running index so sections cascade in down the page

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: barSpace }]} showsVerticalScrollIndicator={false}>
        <Enter index={0} style={styles.head}>
          <PageHeader title={t('play.title')} subtitle={subtitle} />
          {/* Kids see things: the bar is the time left, shrinking as they play. The subtitle already says it aloud. */}
          {limitMinutes != null && limitMinutes > 0 && leftS != null && <ProgressBar progress={leftS / (limitMinutes * 60)} label={subtitle} remaining decorative />}
        </Enter>

        {!loaded && failed && !retrying ? (
          <Card>
            <EmptyState
              icon="help"
              title={t('play.loadFailed')}
              body={t('play.loadFailedSub')}
              action={t('play.retry')}
              onAction={async () => {
                setRetrying(true);
                await reload();
                setRetrying(false);
              }}
            />
          </Card>
        ) : !loaded ? (
          <Card hero style={styles.skeleton}>
            {null}
          </Card>
        ) : featured ? (
          <Enter index={1}>
            <Featured meta={GAMES[featured].meta} lane={lane} focused={focused && live} onPlay={() => play(featured)} />
          </Enter>
        ) : (
          // Nothing open right now: say so kindly, with no lock and no price.
          <Card>
            <EmptyState icon="game" title={t('play.moreGamesSub')} />
          </Card>
        )}

        {sections.map((section) => {
          const games = section.games.filter((id) => id !== featured);
          if (games.length === 0) return null;
          // Decided on the whole section, so the layout doesn't change when the featured game rotates.
          const grid = GRID_SECTIONS.includes(section.title) || section.games.length < 4;
          return (
            <Enter key={section.title} index={order++} style={styles.section}>
              <SectionHeader title={t(section.title)} />
              {grid ? (
                <View style={styles.grid}>
                  {games.map((id) => (
                    <View key={id} style={{ width: gridW }}>
                      <GridTile meta={GAMES[id].meta} lane={lane} focused={focused} live={live} onPress={() => play(id)} />
                    </View>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shelfScroll} contentContainerStyle={styles.shelf}>
                  {games.map((id) => (
                    <ShelfTile key={id} meta={GAMES[id].meta} lane={lane} focused={focused} live={live} onPress={() => play(id)} />
                  ))}
                </ScrollView>
              )}
            </Enter>
          );
        })}

        {hidden && featured && (
          <Enter index={order++}>
            <Card onPress={() => setMoreOpen(true)} accessibilityLabel={t('play.moreGames')} style={styles.more}>
              <View style={styles.moreIcon}>
                <Icon name="game" size={iconSize.lg} color={color.text2} strokeWidth={iconStroke(iconSize.lg)} />
              </View>
              <Text style={[styles.name, styles.grow]}>{t('play.moreGames')}</Text>
              <Icon name="chevron" size={iconSize.sm} color={color.text3} strokeWidth={iconStroke(iconSize.sm)} />
            </Card>
          </Enter>
        )}
      </ScrollView>
      <StatusScrim />
      {/* Free plan: a friendly note, never a price, a lock wall or a way to pay. */}
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t('play.moreGames')}>
        <EmptyState icon="game" title={t('play.moreGamesSub')} />
      </BottomSheet>
      {lock && <TimesUp lock={lock} />}
    </View>
  );
}

/** The game's scene on its own colour. Decorative: the tile around it carries the name for screen readers. */
function Stage({ meta, active, height }: { meta: GameMeta; active: boolean; height: number }) {
  const { Scene } = meta;
  return (
    <View style={[styles.stage, { height, backgroundColor: meta.tint }]} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
      <Scene active={active} />
    </View>
  );
}

function Featured({ meta, lane, focused, onPlay }: { meta: GameMeta; lane: Lane; focused: boolean; onPlay: () => void }) {
  const { t } = useT();
  const name = t(meta.name);
  return (
    <Card hero tactile flush>
      {/* The art is a big tap target for small hands; screen readers get the one Play button. */}
      <PressScale onPress={onPlay} pressedScale={0.98} accessible={false} importantForAccessibility="no-hide-descendants">
        <Stage meta={meta} active={focused} height={HERO_STAGE} />
      </PressScale>
      <View style={styles.heroFoot}>
        <View style={styles.grow}>
          <Text style={styles.heroName} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {name}
          </Text>
          <Text style={styles.sub} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {meta.sub(lane, t)}
          </Text>
        </View>
        <Button label={t('play.play')} accessibilityLabel={`${t('play.play')}: ${name}`} size="md" block={false} onPress={onPlay} />
      </View>
    </Card>
  );
}

/** One control per tile: art, name and best score. Its scene plays for a few seconds, then holds its frame. */
function ShelfTile({ meta, lane, focused, live, onPress }: { meta: GameMeta; lane: Lane; focused: boolean; live: boolean; onPress: () => void }) {
  const { t } = useT();
  const name = t(meta.name);
  return (
    // No label override: the name and the best score inside are what a screen reader says.
    <PressScale onPress={onPress} pressedScale={0.97} accessibilityRole="button" style={styles.shelfTile}>
      <Card tactile flush>
        <Stage meta={meta} active={focused && live} height={SHELF_TILE} />
      </Card>
      <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={1.3}>
        {name}
      </Text>
      <Best meta={meta} lane={lane} focused={focused} />
    </PressScale>
  );
}

function GridTile({ meta, lane, focused, live, onPress }: { meta: GameMeta; lane: Lane; focused: boolean; live: boolean; onPress: () => void }) {
  const { t } = useT();
  const name = t(meta.name);
  const sub = meta.sub(lane, t);
  return (
    <Card tactile flush onPress={onPress}>
      <Stage meta={meta} active={focused && live} height={GRID_STAGE} />
      <View style={styles.gridFoot}>
        <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {name}
        </Text>
        {/* Two lines kept even when the line is short, so cards in a row end level. */}
        <Text style={[styles.sub, styles.twoLines]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {sub}
        </Text>
        <Best meta={meta} lane={lane} focused={focused} />
      </View>
    </Card>
  );
}

/** Best score as three stars and the score in words; nothing until there's a score. */
function Best({ meta, lane, focused }: { meta: GameMeta; lane: Lane; focused: boolean }) {
  const { t } = useT();
  const { read } = useBest(meta.id, lane);
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    if (focused) setValue(read()); // re-read after coming back from a game
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps
  if (value == null || !meta.best || meta.best.hiddenFor?.includes(lane)) return null;
  const earned = meta.best.stars(value, lane);
  const label = meta.best.format(value, lane, t);
  return (
    <View style={styles.best} accessibilityLabel={label}>
      {[0, 1, 2].map((i) => (
        <Icon key={i} name="star" size={iconSize.sm} color={i < earned ? color.reward : color.text3} filled={i < earned} />
      ))}
      <Text style={styles.bestText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  content: { paddingHorizontal: layout.gutter, gap: layout.section, alignSelf: 'center', width: '100%', maxWidth: layout.maxContent },
  head: { gap: space.md },
  section: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  shelfScroll: { marginHorizontal: -layout.gutter },
  shelf: { gap: space.md, paddingHorizontal: layout.gutter },
  shelfTile: { width: SHELF_TILE, gap: space.xs },
  stage: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  heroFoot: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg },
  gridFoot: { padding: space.lg, gap: space.xs },
  grow: { flex: 1, gap: space.xs },
  heroName: { color: color.text, fontFamily: font.title, ...type.heading },
  name: { color: color.text, fontFamily: font.title, ...type.lead },
  sub: { color: color.text2, fontFamily: font.medium, ...type.small },
  twoLines: { minHeight: leading.small * 2 },
  best: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  bestText: { flexShrink: 1, color: color.text2, fontFamily: font.semibold, ...type.caption },
  skeleton: { height: HERO_STAGE + control.lg + space.xl, opacity: 0.5 },
  more: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  moreIcon: { width: control.md, height: control.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface2 },
}));
