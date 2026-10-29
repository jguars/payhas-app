import { useEvent } from 'expo';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { Pop } from '@/components/motion/Pop';
import { PressScale } from '@/components/motion/PressScale';
import { useToast } from '@/components/Toast';
import { useLibrary } from '@/features/library/LibraryProvider';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { alpha, color, font, lane as lanes, media, radius, themedStyles } from '@/theme/tokens';

import { FeedVideo, formatCount } from './data';
import { HeartBurst } from './HeartBurst';
import { FloatingEmoji, ReactionBar } from './ReactionBar';

const DOUBLE_TAP_MS = 280;
const IMPRESSION_MS = 1000; // on screen this long = seen
const QUICK_SKIP_MS = 2000; // gone before this = skipped (tasteEngine quickSkip)
const FINISH_AT = 0.9;
// The clips next to the playing one (the list keeps them mounted) buffer just enough to start
// at once; the playing clip goes back to the platform defaults (Android 20 s, iOS automatic).
const PRELOAD_BUFFER = { preferredForwardBufferDuration: 5, minBufferForPlayback: 1, waitsToMinimizeStalling: true };
const PLAYING_BUFFER = { preferredForwardBufferDuration: Platform.OS === 'ios' ? 0 : 20, minBufferForPlayback: 2, waitsToMinimizeStalling: true };
const RAIL_RIGHT = 10;
const META_LEFT = 16;
const PILL_H = 32;
const DISC = 34;

type Props = {
  video: FeedVideo;
  active: boolean;
  height: number;
  /** Space taken by the floating tab bar; captions and the rail sit above it. */
  chromeBottom: number;
  onShare: (v: FeedVideo) => void;
  onOptions: (v: FeedVideo) => void;
  onCreator: (name: string) => void;
};

function FeedItemBase({ video, active, height, chromeBottom, onShare, onOptions, onCreator }: Props) {
  const player = useVideoPlayer(video.source, (p) => {
    p.loop = true;
    // Browsers block autoplay with sound; native starts unmuted.
    p.muted = Platform.OS === 'web';
    p.timeUpdateEventInterval = 0.25;
    if (Platform.OS !== 'web') p.bufferOptions = PRELOAD_BUFFER;
  });

  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  const time = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const progress = player.duration > 0 ? Math.min(1, time.currentTime / player.duration) : 0;
  const { width } = useWindowDimensions();

  // Every video plays whole, exactly as shot, centred over a blurred copy of its poster —
  // never cropped. A 9:16 clip on a taller phone leaves thin strips that sit behind the top
  // tabs and the tab bar; a landscape clip sits in the middle. Only a video already the
  // screen's exact shape (within 3%) fills edge to edge.
  const loaded = useEvent(player, 'sourceLoad', null);
  const track = (loaded?.availableVideoTracks ?? player.availableVideoTracks)?.[0]?.size;
  const videoAspect = track?.width && track?.height ? track.width / track.height : null;
  const screenAspect = width / height;
  const fill = videoAspect != null && Math.abs(videoAspect - screenAspect) / screenAspect < 0.03;

  const lib = useLibrary();
  const toast = useToast();
  const { t } = useT();
  const liked = lib.liked.has(video.id);
  const saved = lib.saved.has(video.id);
  const following = lib.following.has(video.creator.name);
  const mine = lib.reacted.get(video.id) ?? new Set<string>();
  const likeCount = video.likes + lib.likeDelta(video.id);

  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [floaters, setFloaters] = useState<{ id: number; emoji: string }[]>([]);
  const [picking, setPicking] = useState(false);
  // The caption opens on tap to show all of it, plus credit and source; it closes again when the video changes.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!active) setExpanded(false);
  }, [active]);
  const seq = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'web') player.bufferOptions = active ? PLAYING_BUFFER : PRELOAD_BUFFER;
    if (active) {
      player.currentTime = 0;
      player.play();
    } else {
      player.pause();
      setPicking(false);
    }
  }, [active, player]);

  // ── signals: watch time, impression, quick skip, finish, rewatch ──────────
  const startedAt = useRef<number | null>(null);
  const finished = useRef(false);
  const lastTime = useRef(0);
  useEffect(() => {
    if (!active) return;
    startedAt.current = Date.now();
    finished.current = false;
    lastTime.current = 0;
    const seen = setTimeout(() => lib.signal(video.id, 'impression'), IMPRESSION_MS);
    return () => {
      clearTimeout(seen);
      const ms = startedAt.current ? Date.now() - startedAt.current : 0;
      if (ms < QUICK_SKIP_MS) lib.signal(video.id, 'quick_skip');
      lib.logWatch(video.id, ms / 1000);
      startedAt.current = null;
    };
  }, [active, video.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active || player.duration <= 0) return;
    const t = time.currentTime;
    if (!finished.current && t / player.duration >= FINISH_AT) {
      finished.current = true;
      lib.signal(video.id, 'finish');
    } else if (finished.current && t + 1 < lastTime.current) {
      lib.signal(video.id, 'rewatch'); // looped back to the start after finishing
    }
    lastTime.current = t;
  }, [time.currentTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── taps: single = sound/pause (after a short wait), double = like ───────
  const lastTap = useRef(0);
  const single = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTap = (e: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = e.nativeEvent;
    const now = Date.now();
    if (picking) return setPicking(false);
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      if (single.current) clearTimeout(single.current);
      lastTap.current = 0;
      lib.likeOnce(video.id);
      fx.heart();
      setBursts((b) => [...b, { id: ++seq.current, x, y }]);
      return;
    }
    lastTap.current = now;
    single.current = setTimeout(() => {
      if (muted) player.muted = false;
      else if (player.playing) player.pause();
      else player.play();
    }, DOUBLE_TAP_MS);
  };

  const react = (emoji: string) => {
    const adding = !mine.has(emoji);
    lib.toggleReaction(video.id, emoji);
    if (adding) fx.react();
    else fx.tap();
    setPicking(false);
    if (adding) setFloaters((f) => [...f, { id: ++seq.current, emoji }]);
  };

  const save = () => {
    lib.toggleSave(video.id);
    if (saved) fx.tap();
    else fx.save();
    if (!saved) toast({ text: t('feed.saved'), icon: 'save', action: { label: t('feed.view'), onPress: () => router.push('/saved') } });
  };

  // The top three reactions (own picks count too), shown as pills under the caption.
  const counts = new Map<string, number>();
  for (const [e, c] of Object.entries(video.reactions)) counts.set(e, c + lib.reactionDelta(video.id, e));
  for (const e of mine) if (!(e in video.reactions)) counts.set(e, 1);
  const topReactions = [...counts.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1] || Number(mine.has(b[0])) - Number(mine.has(a[0])))
    .slice(0, 3);

  const metaBottom = chromeBottom + 4;
  const railBottom = chromeBottom + 2;
  const [plusX, setPlusX] = useState(0);

  return (
    <View style={[styles.root, { height }]}>
      {!fill && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={video.thumb} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={28} />
          <View style={styles.blurDim} />
        </View>
      )}
      <VideoView
        player={player}
        style={styles.video}
        contentFit={fill ? 'cover' : 'contain'}
        // A TextureView lets the blurred fill show around a fitted video (a SurfaceView paints it black).
        surfaceType="textureView"
        nativeControls={false}
        playsInline
      />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onTap}
        onLongPress={() => {
          fx.longPress();
          onOptions(video);
        }}
        delayLongPress={420}
        accessibilityLabel={muted ? t('feed.a11y.unmute') : t('feed.a11y.playPause')}
      />

      <View pointerEvents="none" style={styles.scrimBottom} />

      {muted && (
        <View pointerEvents="none" style={styles.mutedHint}>
          <Icon name="muted" size={16} />
          <Text style={styles.mutedText}>{t('feed.tapForSound')}</Text>
        </View>
      )}

      {bursts.map((b) => (
        <HeartBurst key={b.id} x={b.x} y={b.y} onDone={() => setBursts((all) => all.filter((x) => x.id !== b.id))} />
      ))}

      {/* Right rail: icon + count, no discs (Sora). */}
      <View style={[styles.rail, { bottom: railBottom }]}>
        <Pressable style={styles.action} onPress={() => {
            if (liked) fx.unlike();
            else fx.like();
            lib.toggleLike(video.id);
          }} accessibilityLabel={t('feed.like')} accessibilityState={{ selected: liked }}>
          <Pop on={liked}>
            <Icon name="heart" size={30} color={liked ? color.ember : media.text} filled={liked} strokeWidth={1.8} />
          </Pop>
          <Text style={styles.count}>{formatCount(likeCount)}</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={save} accessibilityLabel={t('feed.save')} accessibilityState={{ selected: saved }}>
          <Pop on={saved}>
            <Icon name="save" size={27} color={saved ? lanes.little.color : media.text} filled={saved} strokeWidth={1.8} />
          </Pop>
          <Text style={styles.count}>{formatCount(video.saves + lib.saveDelta(video.id))}</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => {
            fx.sheet();
            onShare(video);
          }} accessibilityLabel={t('feed.share')}>
          <Icon name="send" size={27} strokeWidth={1.8} />
          <Text style={styles.count}>{formatCount(video.shares)}</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => {
            fx.longPress();
            onOptions(video);
          }} accessibilityLabel={t('feed.moreOptions')}>
          <Icon name="more" size={26} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Bottom-left: creator, caption, reaction pills (Sora + Character AI). */}
      <View style={[styles.meta, { bottom: metaBottom }]} pointerEvents="box-none">
        <View style={styles.creatorRow}>
          <View style={styles.discWrap}>
            <Pressable onPress={() => {
                fx.sheet();
                onCreator(video.creator.name);
              }} accessibilityRole="button" accessibilityLabel={t('feed.creatorVideos', { name: video.creator.name })} hitSlop={6}>
              <View style={styles.disc}>
                <Text style={styles.discLetter}>{video.creator.name[0]?.toUpperCase()}</Text>
              </View>
            </Pressable>
            <FollowBadge following={following} onFollow={() => lib.toggleFollow(video.creator.name)} name={video.creator.name} />
          </View>
          <Pressable onPress={() => {
              fx.sheet();
              onCreator(video.creator.name);
            }} style={styles.creatorName} hitSlop={8} importantForAccessibility="no" accessibilityElementsHidden>
            <Text style={styles.creator} numberOfLines={1}>{video.creator.name}</Text>
            {video.creator.verified && <Icon name="verified" size={14} color={color.verified} />}
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            fx.tap();
            setExpanded((e) => !e);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityHint={expanded ? t('feed.caption.less') : t('feed.caption.more')}
          hitSlop={8}
          style={[styles.captionBox, expanded && styles.captionBoxOpen]}
        >
          <Text style={styles.caption} numberOfLines={expanded ? undefined : 1}>
            {video.caption}
          </Text>
          {expanded && (video.credit || video.origin) && (
            <Animated.View entering={FadeIn.duration(180)} style={styles.captionMore}>
              {!!video.credit && <Text style={styles.credit}>{video.credit}</Text>}
              {!!video.origin && (
                <Text style={styles.credit}>
                  {t('feed.caption.source', { name: video.origin.name })}
                  {video.origin.license ? ` · ${video.origin.license}` : ''}
                </Text>
              )}
            </Animated.View>
          )}
        </Pressable>
        <View style={styles.pills}>
          {topReactions.map(([emoji, n]) => (
            <ReactionPill key={emoji} emoji={emoji} count={n} on={mine.has(emoji)} onPress={() => react(emoji)} />
          ))}
          <View onLayout={(e) => setPlusX(e.nativeEvent.layout.x + e.nativeEvent.layout.width / 2)}>
            <MorePill
              open={picking}
              onPress={() => {
                fx.tap();
                setPicking((p) => !p);
              }}
            />
          </View>
        </View>
      </View>

      {picking && (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)} style={[styles.reactionBar, { bottom: metaBottom + PILL_H + 10 }]}>
          <ReactionBar mine={mine} onPick={react} />
        </Animated.View>
      )}

      {floaters.map((f) => (
        <FloatingEmoji
          key={f.id}
          emoji={f.emoji}
          fromX={META_LEFT + plusX}
          fromY={height - metaBottom - PILL_H / 2}
          onDone={() => setFloaters((all) => all.filter((x) => x.id !== f.id))}
        />
      ))}

      <View style={[styles.progressTrack, { bottom: chromeBottom - 8 }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

/** One of the top reactions: emoji + count in a small translucent pill; tap toggles yours. */
function ReactionPill({ emoji, count, on, onPress }: { emoji: string; count: number; on: boolean; onPress: () => void }) {
  const { t } = useT();
  return (
    <PressScale
      onPress={onPress}
      pressedScale={0.92}
      hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
      accessibilityRole="button"
      accessibilityLabel={t('feed.reactionPill', { emoji, count })}
      accessibilityState={{ selected: on }}
      style={[styles.pill, on && styles.pillOn]}
    >
      <Pop on={on}>
        <Text style={styles.pillEmoji}>{emoji}</Text>
      </Pop>
      <Text style={styles.pillCount}>{formatCount(count)}</Text>
    </PressScale>
  );
}

/** The "+" pill that opens the full reaction picker; the plus turns into a × while it's open. */
function MorePill({ open, onPress }: { open: boolean; onPress: () => void }) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = reduce ? (open ? 45 : 0) : withSpring(open ? 45 : 0, spring.snappy);
  }, [open, reduce, r]);
  const anim = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <PressScale
      onPress={onPress}
      pressedScale={0.92}
      hitSlop={{ top: 6, bottom: 6, left: 2, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={t('feed.react')}
      accessibilityState={{ expanded: open }}
      style={[styles.pill, styles.pillMore, open && styles.pillOn]}
    >
      <Icon name="smile" size={17} strokeWidth={2} />
      <Animated.View style={anim}>
        <Icon name="plus" size={12} strokeWidth={2.8} />
      </Animated.View>
    </PressScale>
  );
}

/** The "+" on the creator disc: tap → spins into a green tick, holds, then tucks away. */
function FollowBadge({ following, onFollow, name }: { following: boolean; onFollow: () => void; name: string }) {
  const { t } = useT();
  const [phase, setPhase] = useState<'plus' | 'tick' | 'gone'>(following ? 'gone' : 'plus');
  const s = useSharedValue(1);
  const r = useSharedValue(0);

  // Unfollowed elsewhere (creator sheet, Following list) → the "+" comes back.
  useEffect(() => {
    if (!following) {
      setPhase('plus');
      s.value = withSpring(1, spring.snappy);
      r.value = 0;
    } else if (phase === 'plus') {
      setPhase('gone');
    }
  }, [following]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = () => {
    fx.follow();
    setPhase('tick');
    r.value = withTiming(360, { duration: 380 });
    s.value = withSequence(withSpring(1.3, spring.bouncy), withTiming(1, { duration: 120 }), withTiming(1, { duration: 700 }), withTiming(0, { duration: 180 }));
    onFollow();
    setTimeout(() => setPhase('gone'), 1300);
  };

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { rotate: `${r.value}deg` }] }));
  if (phase === 'gone') return null;
  return (
    <Animated.View style={[styles.follow, phase === 'tick' && styles.followDone, anim]}>
      <Pressable onPress={press} disabled={phase === 'tick'} accessibilityLabel={t('feed.followName', { name })} hitSlop={10} style={styles.followHit}>
        <Icon name={phase === 'tick' ? 'check' : 'plus'} size={12} color={color.ink} strokeWidth={3.5} />
      </Pressable>
    </Animated.View>
  );
}

export const FeedItem = memo(FeedItemBase);

const SHADOW = { textShadowColor: alpha(color.black, 0.45), textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 } as const;

const styles = themedStyles(() => ({
  root: { width: '100%', backgroundColor: color.ink, overflow: 'hidden' },
  video: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', backgroundColor: 'transparent' },
  blurDim: { ...StyleSheet.absoluteFill, backgroundColor: alpha(color.ink, 0.45) },
  scrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 300,
    experimental_backgroundImage: 'linear-gradient(0deg, rgba(10,10,15,0.72), rgba(10,10,15,0))',
  },
  mutedHint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: alpha(color.ink, 0.55),
  },
  mutedText: { color: media.text, fontFamily: font.semibold, fontSize: 13 },
  rail: { position: 'absolute', right: RAIL_RIGHT, alignItems: 'center', gap: 14 },
  action: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  count: { color: media.text, fontFamily: font.mono, fontSize: 12, ...SHADOW },
  meta: { position: 'absolute', left: META_LEFT, right: 76, gap: 8 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  discWrap: { width: DISC + 4, height: DISC + 4, alignItems: 'center', justifyContent: 'center' },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 1.5,
    borderColor: alpha(media.text, 0.9),
    backgroundColor: media.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discLetter: { color: media.text, fontFamily: font.title, fontSize: 15 },
  creatorName: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  creator: { color: media.text, fontFamily: font.bold, fontSize: 15, flexShrink: 1, ...SHADOW },
  follow: { position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: color.ink, backgroundColor: color.ember },
  followDone: { backgroundColor: lanes.kids.color },
  followHit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { color: media.text, fontFamily: font.body, fontSize: 14, lineHeight: 20, ...SHADOW },
  credit: { color: alpha(media.text, 0.72), fontFamily: font.medium, fontSize: 12, lineHeight: 17 },
  captionBox: { marginHorizontal: -10, marginVertical: -4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  captionBoxOpen: { backgroundColor: alpha(color.ink, 0.55), marginVertical: 0, paddingVertical: 8 },
  captionMore: { gap: 2, marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: alpha(media.text, 0.25) },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  pill: {
    height: PILL_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha(media.text, 0.18),
    backgroundColor: alpha(color.ink, 0.38),
  },
  pillOn: { borderColor: color.ember, backgroundColor: alpha(color.ember, 0.22) },
  pillMore: { gap: 2, paddingHorizontal: 9 },
  pillEmoji: { fontSize: 15 },
  pillCount: { color: media.text, fontFamily: font.mono, fontSize: 12 },
  reactionBar: { position: 'absolute', left: META_LEFT - 6 },
  progressTrack: { position: 'absolute', left: 16, right: 16, height: 2, borderRadius: 1, overflow: 'hidden', backgroundColor: alpha(media.text, 0.2) },
  progressFill: { height: 2, backgroundColor: media.text },
}));
