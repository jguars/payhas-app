import { useEvent } from 'expo';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { Pop } from '@/components/motion/Pop';
import { PressScale } from '@/components/motion/PressScale';
import { useToast } from '@/components/Toast';
import { useFamily } from '@/features/family/FamilyProvider';
import { useLibrary } from '@/features/library/LibraryProvider';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { alpha, border, color, control, font, iconSize, iconStroke, media, radius, size, space, themedStyles } from '@/theme/tokens';

import { FeedVideo, formatCount } from './data';
import { FeedScrims } from './FeedScrims';
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
/** How far two fingers must spread (or close) before full display turns on (or off). */
const PINCH_OUT = 1.25;
const PINCH_IN = 0.8;
const META_LEFT = 16;
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
  /** Called with true while the video is held down (all chrome hides), false on release. */
  onClear?: (clear: boolean) => void;
  /** Full display: every overlay hidden until the child pinches back in. Owned by Home so it survives swiping. */
  full?: boolean;
  onFull?: (full: boolean) => void;
  /** True while two fingers are down, so the list can stop scrolling under a pinch. */
  onPinching?: (pinching: boolean) => void;
};

function FeedItemBase({ video, active, height, chromeBottom, onShare, onOptions, onCreator, onClear, full = false, onFull, onPinching }: Props) {
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
  // never cropped. A 9:16 clip on a taller phone leaves thin strips above and below (the
  // tab bar is docked under the feed); a landscape clip sits in the middle. Only a video
  // already the feed's exact shape (within 3%) fills edge to edge.
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
  // Children never see popularity numbers; adults see them only when there is one.
  const { current } = useFamily();
  const child = current?.lane !== 'adult';
  const showCount = (n: number) => !child && n > 0;

  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [floaters, setFloaters] = useState<{ id: number; emoji: string }[]>([]);
  const [picking, setPicking] = useState(false);
  // Press and hold: everything on the video hides until the finger lifts (Instagram Reels).
  const [clear, setClear] = useState(false);
  // Pinch out (fingers apart) = full display; pinch in (fingers together) = buttons back.
  const pinch = useRef<{ start: number; done: boolean } | null>(null);
  const spread = (t: readonly { pageX: number; pageY: number }[]) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  const onTouchStart = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches;
    if (t.length === 2) {
      pinch.current = { start: spread(t), done: false };
      onPinching?.(true);
    }
  };
  const onTouchMove = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches;
    const p = pinch.current;
    if (!p || p.done || t.length < 2 || p.start === 0) return;
    const ratio = spread(t) / p.start;
    if (ratio > PINCH_OUT && !full) {
      p.done = true;
      fx.tap();
      onFull?.(true);
    } else if (ratio < PINCH_IN && full) {
      p.done = true;
      fx.tap();
      onFull?.(false);
    }
  };
  const onTouchEnd = (e: GestureResponderEvent) => {
    if (pinch.current && e.nativeEvent.touches.length < 2) {
      pinch.current = null;
      onPinching?.(false);
    }
  };
  const hold = (on: boolean) => {
    setClear(on);
    onClear?.(on);
  };
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

  const follow = () => {
    const now = !following;
    lib.toggleFollow(video.creator.name);
    if (now) {
      fx.follow();
      toast({ text: t('feed.nowFollowing', { name: video.creator.name }), icon: 'check' });
    } else fx.tap();
  };

  const like = () => {
    if (liked) fx.unlike();
    else fx.like();
    lib.toggleLike(video.id);
  };

  const save = () => {
    lib.toggleSave(video.id);
    if (saved) fx.tap();
    else fx.save();
    if (!saved) toast({ text: t('feed.saved'), icon: 'save', action: { label: t('feed.view'), onPress: () => router.push('/saved') } });
  };

  const metaBottom = chromeBottom + 4;
  const railBottom = chromeBottom + 2;
  // The react button is 4th from the bottom of the rail (more, send, save, react, heart).
  const reactBottom = railBottom + 3 * (control.md + space.xs);

  return (
    <View style={[styles.root, { height }]} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      {!fill && (
        // Decorative backdrop: hidden from screen readers.
        <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants">
          <Image source={video.thumb} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={28} alt="" accessible={false} />
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
          setPicking(false);
          hold(true);
        }}
        onPressOut={() => clear && hold(false)}
        delayLongPress={420}
        accessibilityRole="button"
        accessibilityLabel={muted ? t('feed.a11y.unmute') : t('feed.a11y.playPause')}
        // Screen readers get the gestures as actions instead of "double tap to like" hints.
        accessibilityActions={[
          { name: 'like', label: t('feed.like') },
          { name: 'options', label: t('feed.moreOptions') },
          { name: 'full', label: full ? t('feed.a11y.fullOff') : t('feed.a11y.fullOn') },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'like') like();
          else if (e.nativeEvent.actionName === 'options') onOptions(video);
          else if (e.nativeEvent.actionName === 'full') onFull?.(!full);
        }}
      />

      {/* Everything on top of the picture; hidden while the video is held down. */}
      <View pointerEvents={clear || full ? 'none' : 'box-none'} style={[StyleSheet.absoluteFill, (clear || full) && styles.hidden]}>
        <FeedScrims railBottom={railBottom} />

        {muted && (
          <View pointerEvents="none" style={styles.mutedHint}>
            <Icon name="muted" size={iconSize.sm} color={media.text} />
            <Text style={styles.mutedText}>{t('feed.tapForSound')}</Text>
          </View>
        )}

        {bursts.map((b) => (
          <HeartBurst key={b.id} x={b.x} y={b.y} onDone={() => setBursts((all) => all.filter((x) => x.id !== b.id))} />
        ))}

        {/* Right rail: quiet icons (Sora); counts only for adults, never a zero. */}
        <View style={[styles.rail, { bottom: railBottom }]}>
          <Pressable style={styles.action} onPress={like} accessibilityRole="button" accessibilityLabel={t('feed.like')} accessibilityState={{ selected: liked }}>
            <Pop on={liked}>
              <Icon name="heart" size={iconSize.feed} color={liked ? color.ember : media.text} filled={liked} strokeWidth={iconStroke(iconSize.feed)} />
            </Pop>
            {showCount(likeCount) && <Text style={styles.count}>{formatCount(likeCount)}</Text>}
          </Pressable>

          {/* React: the smiley, or the emoji you picked. Opens the picker beside the rail. */}
          <Pressable
            style={styles.action}
            onPress={() => {
              fx.tap();
              setPicking((p) => !p);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('feed.react')}
            accessibilityState={{ expanded: picking, selected: mine.size > 0 }}
          >
            {mine.size > 0 ? (
              <Text style={styles.myEmoji}>{[...mine][0]}</Text>
            ) : (
              <Icon name="smile" size={iconSize.feed} color={media.text} strokeWidth={iconStroke(iconSize.feed)} />
            )}
          </Pressable>

          <Pressable style={styles.action} onPress={save} accessibilityRole="button" accessibilityLabel={t('feed.save')} accessibilityState={{ selected: saved }}>
            <Pop on={saved}>
              <Icon name="save" size={iconSize.feed} color={media.text} filled={saved} strokeWidth={iconStroke(iconSize.feed)} />
            </Pop>
            {showCount(video.saves + lib.saveDelta(video.id)) && <Text style={styles.count}>{formatCount(video.saves + lib.saveDelta(video.id))}</Text>}
          </Pressable>

          <Pressable
            style={styles.action}
            onPress={() => {
              fx.sheet();
              onShare(video);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('feed.share')}
          >
            <Icon name="send" size={iconSize.feed} color={media.text} strokeWidth={iconStroke(iconSize.feed)} />
            {showCount(video.shares) && <Text style={styles.count}>{formatCount(video.shares)}</Text>}
          </Pressable>

          <Pressable
            style={styles.action}
            onPress={() => {
              fx.longPress();
              onOptions(video);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('feed.moreOptions')}
          >
            <Icon name="more" size={iconSize.feed} color={media.text} strokeWidth={iconStroke(iconSize.feed)} />
          </Pressable>
        </View>

        {/* Bottom-left: creator and caption (Sora). */}
        <View style={[styles.meta, { bottom: metaBottom }]} pointerEvents="box-none">
          <View style={styles.creatorRow}>
            <Pressable
              onPress={() => {
                fx.sheet();
                onCreator(video.creator.name);
              }}
              style={styles.creatorName}
              accessibilityRole="button"
              accessibilityLabel={t('feed.creatorVideos', { name: video.creator.name })}
            >
              <View style={styles.disc}>
                <Text style={styles.discLetter}>{video.creator.name[0]?.toUpperCase()}</Text>
              </View>
              <Text style={styles.creator} numberOfLines={1}>{video.creator.name}</Text>
              {video.creator.verified && <Icon name="verified" size={iconSize.sm} color={color.verified} />}
            </Pressable>
            <PressScale
              onPress={follow}
              pressedScale={0.94}
              hitSlop={space.sm}
              accessibilityRole="button"
              accessibilityLabel={following ? t('feed.unfollowName', { name: video.creator.name }) : t('feed.followName', { name: video.creator.name })}
              accessibilityState={{ selected: following }}
              style={[styles.followPill, following && styles.followPillOn]}
            >
              {following ? (
                <Icon name="check" size={iconSize.md} color={media.text} strokeWidth={iconStroke(iconSize.md)} />
              ) : (
                <Text style={styles.followText}>{t('feed.follow')}</Text>
              )}
            </PressScale>
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
        </View>

        {picking && (
          <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)} style={[styles.reactionBar, { bottom: reactBottom }]}>
            <ReactionBar mine={mine} onPick={react} />
          </Animated.View>
        )}

        {floaters.map((f) => (
          <FloatingEmoji
            key={f.id}
            emoji={f.emoji}
            fromX={width - RAIL_RIGHT - control.md / 2}
            fromY={height - reactBottom - control.md / 2}
            onDone={() => setFloaters((all) => all.filter((x) => x.id !== f.id))}
          />
        ))}
        <View style={[styles.progressTrack, { bottom: chromeBottom - space.sm }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

export const FeedItem = memo(FeedItemBase);

const SHADOW = { textShadowColor: alpha(color.black, 0.45), textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 } as const;

const styles = themedStyles(() => ({
  root: { width: '100%', backgroundColor: color.ink, overflow: 'hidden' },
  video: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', backgroundColor: 'transparent' },
  blurDim: { ...StyleSheet.absoluteFill, backgroundColor: alpha(color.ink, 0.45) },
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
  mutedText: { color: media.text, fontFamily: font.semibold, fontSize: size.small },
  hidden: { opacity: 0 },
  rail: { position: 'absolute', right: RAIL_RIGHT, alignItems: 'center', gap: space.xs },
  myEmoji: { fontSize: iconSize.feed - space.xs, lineHeight: iconSize.feed + space.xs },
  // A shadow that follows the icon's own shape: iOS draws it from the layer, Android and web
  // from a drop-shadow filter (a box shadow would draw a grey square).
  action: {
    minWidth: control.md,
    minHeight: control.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs / 2,
    ...Platform.select({
      ios: { shadowColor: media.scrim, shadowOpacity: 0.55, shadowRadius: space.xs, shadowOffset: { width: 0, height: border.hairline } },
      default: { filter: `drop-shadow(0px ${border.hairline}px ${space.xs}px ${alpha(media.scrim, 0.6)})` },
    }),
  },
  count: { color: media.text, fontFamily: font.mono, fontSize: size.caption, ...SHADOW },
  meta: { position: 'absolute', left: META_LEFT, right: 76, gap: 8 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start' },
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
  discLetter: { color: media.text, fontFamily: font.title, fontSize: size.body },
  creatorName: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1, minHeight: control.md },
  creator: { color: media.text, fontFamily: font.bold, fontSize: size.body, flexShrink: 1, ...SHADOW },
  followPill: {
    height: control.sm - space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: border.strong,
    borderColor: alpha(media.text, 0.7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  followPillOn: { borderColor: 'transparent', backgroundColor: alpha(media.text, 0.16), width: control.sm - space.sm, paddingHorizontal: 0 },
  followText: { color: media.text, fontFamily: font.bold, fontSize: size.small },
  caption: { color: media.text, fontFamily: font.medium, fontSize: size.small, lineHeight: 20, ...SHADOW },
  credit: { color: alpha(media.text, 0.72), fontFamily: font.medium, fontSize: size.caption, lineHeight: 17 },
  captionBox: { marginHorizontal: -10, marginVertical: -4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  captionBoxOpen: { backgroundColor: alpha(color.ink, 0.55), marginVertical: 0, paddingVertical: 8 },
  captionMore: { gap: 2, marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: alpha(media.text, 0.25) },
  reactionBar: { position: 'absolute', right: RAIL_RIGHT + control.md },
  progressTrack: { position: 'absolute', left: 16, right: 16, height: 2, borderRadius: 1, overflow: 'hidden', backgroundColor: alpha(media.text, 0.2) },
  progressFill: { height: 2, backgroundColor: media.text },
}));
