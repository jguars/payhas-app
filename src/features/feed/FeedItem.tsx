import { useEvent } from 'expo';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { Pop } from '@/components/motion/Pop';
import { useToast } from '@/components/Toast';
import { useLibrary } from '@/features/library/LibraryProvider';
import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { color, font } from '@/theme/tokens';

import { FeedVideo, formatCount } from './data';
import { HeartBurst } from './HeartBurst';
import { FloatingEmoji, ReactionBar } from './ReactionBar';

const DOUBLE_TAP_MS = 280;
const IMPRESSION_MS = 1000; // on screen this long = seen
const QUICK_SKIP_MS = 2000; // gone before this = skipped (tasteEngine quickSkip)
const FINISH_AT = 0.9;
const RAIL_RIGHT = 12;
const REACT_FROM_RAIL_BOTTOM = 162; // centre of the react button above the rail's bottom edge

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
  });

  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  const time = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const progress = player.duration > 0 ? Math.min(1, time.currentTime / player.duration) : 0;
  const { width } = useWindowDimensions();

  const lib = useLibrary();
  const toast = useToast();
  const liked = lib.liked.has(video.id);
  const saved = lib.saved.has(video.id);
  const following = lib.following.has(video.creator.name);
  const mine = lib.reacted.get(video.id) ?? new Set<string>();
  const likeCount = video.likes + lib.likeDelta(video.id);
  const reactionCount =
    Object.entries(video.reactions).reduce((n, [e, c]) => n + c + lib.reactionDelta(video.id, e), 0) +
    [...mine].filter((e) => !(e in video.reactions)).length;

  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [floaters, setFloaters] = useState<{ id: number; emoji: string }[]>([]);
  const [picking, setPicking] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
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
    if (!saved) toast({ text: 'Saved', icon: 'save', action: { label: 'View', onPress: () => router.push('/saved') } });
  };

  const railBottom = chromeBottom + 74;

  return (
    <View style={[styles.root, { height }]}>
      <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} playsInline />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onTap}
        onLongPress={() => {
          fx.longPress();
          onOptions(video);
        }}
        delayLongPress={420}
        accessibilityLabel={muted ? 'Unmute. Double tap to like, hold for options' : 'Play or pause. Double tap to like, hold for options'}
      />

      <View pointerEvents="none" style={styles.scrimBottom} />

      {muted && (
        <View pointerEvents="none" style={styles.mutedHint}>
          <Icon name="muted" size={16} />
          <Text style={styles.mutedText}>Tap for sound</Text>
        </View>
      )}

      {bursts.map((b) => (
        <HeartBurst key={b.id} x={b.x} y={b.y} onDone={() => setBursts((all) => all.filter((x) => x.id !== b.id))} />
      ))}

      <View style={[styles.rail, { bottom: railBottom }]}>
        <View style={styles.avatarWrap}>
          <Pressable onPress={() => {
            fx.sheet();
            onCreator(video.creator.name);
          }} accessibilityRole="button" accessibilityLabel={`${video.creator.name}'s videos`} hitSlop={6}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{video.creator.name[0]}</Text>
            </View>
          </Pressable>
          <FollowBadge following={following} onFollow={() => lib.toggleFollow(video.creator.name)} name={video.creator.name} />
        </View>

        <Pressable style={styles.action} onPress={() => {
            if (liked) fx.unlike();
            else fx.like();
            lib.toggleLike(video.id);
          }} accessibilityLabel="Like" accessibilityState={{ selected: liked }}>
          <Pop on={liked}>
            <Icon name="heart" size={32} color={liked ? color.ember : color.text} filled={liked} strokeWidth={1.9} />
          </Pop>
          <Text style={styles.count}>{formatCount(likeCount)}</Text>
        </Pressable>

        <View>
          {picking && (
            <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)} style={styles.reactionBar}>
              <ReactionBar mine={mine} onPick={react} />
            </Animated.View>
          )}
          <Pressable style={styles.action} onPress={() => {
              fx.tap();
              setPicking((p) => !p);
            }} accessibilityLabel="React" accessibilityState={{ expanded: picking }}>
            <Pop on={mine.size > 0}>
              <Icon name="smile" size={30} color={mine.size > 0 ? '#FFD25E' : color.text} strokeWidth={1.9} />
            </Pop>
            <Text style={styles.count}>{formatCount(reactionCount)}</Text>
          </Pressable>
        </View>

        <Pressable style={styles.action} onPress={save} accessibilityLabel="Save" accessibilityState={{ selected: saved }}>
          <Pop on={saved}>
            <Icon name="save" size={28} color={saved ? '#FFD25E' : color.text} filled={saved} strokeWidth={1.9} />
          </Pop>
          <Text style={styles.count}>{formatCount(video.saves + lib.saveDelta(video.id))}</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => {
            fx.sheet();
            onShare(video);
          }} accessibilityLabel="Share">
          <Icon name="share" size={28} strokeWidth={1.9} />
          <Text style={styles.count}>{formatCount(video.shares)}</Text>
        </Pressable>
      </View>

      {floaters.map((f) => (
        <FloatingEmoji
          key={f.id}
          emoji={f.emoji}
          fromX={width - RAIL_RIGHT - 22}
          fromY={height - railBottom - REACT_FROM_RAIL_BOTTOM}
          onDone={() => setFloaters((all) => all.filter((x) => x.id !== f.id))}
        />
      ))}

      <View style={[styles.meta, { bottom: chromeBottom + 4 }]} pointerEvents="box-none">
        <Pressable onPress={() => {
            fx.sheet();
            onCreator(video.creator.name);
          }} style={styles.creatorRow} hitSlop={6}>
          <Text style={styles.creator}>{video.creator.name}</Text>
          {video.creator.verified && <Icon name="verified" size={15} color={color.verified} />}
        </Pressable>
        <Text style={styles.caption} numberOfLines={1}>
          {video.caption}
        </Text>
      </View>

      <View style={[styles.progressTrack, { bottom: chromeBottom - 8 }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

/** The "+" under the avatar: tap → spins into a green tick, holds, then tucks away. */
function FollowBadge({ following, onFollow, name }: { following: boolean; onFollow: () => void; name: string }) {
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
      <Pressable onPress={press} disabled={phase === 'tick'} accessibilityLabel={`Follow ${name}`} hitSlop={10} style={styles.followHit}>
        <Icon name={phase === 'tick' ? 'check' : 'plus'} size={12} color={color.ink} strokeWidth={3.5} />
      </Pressable>
    </Animated.View>
  );
}

export const FeedItem = memo(FeedItemBase);

const styles = StyleSheet.create({
  root: { width: '100%', backgroundColor: color.ink, overflow: 'hidden' },
  video: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  scrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 320,
    experimental_backgroundImage: 'linear-gradient(0deg, rgba(10,10,15,0.8), rgba(10,10,15,0))',
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
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,15,0.55)',
  },
  mutedText: { color: color.text, fontFamily: font.semibold, fontSize: 13 },
  rail: { position: 'absolute', right: RAIL_RIGHT, alignItems: 'center', gap: 18 },
  avatarWrap: { width: 46, height: 56, alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: color.text,
    backgroundColor: color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: color.text, fontFamily: font.display, fontSize: 18 },
  follow: { position: 'absolute', bottom: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: color.ember },
  followDone: { backgroundColor: '#4FE3B0' },
  followHit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  count: { color: color.text, fontFamily: font.mono, fontSize: 12 },
  reactionBar: { position: 'absolute', right: 52, top: -2 },
  meta: { position: 'absolute', left: 16, right: 84, gap: 6 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  creator: { color: color.text, fontFamily: font.bold, fontSize: 16 },
  caption: { color: color.text, fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  progressTrack: { position: 'absolute', left: 16, right: 16, height: 2, borderRadius: 1, overflow: 'hidden', backgroundColor: 'rgba(244,243,239,0.2)' },
  progressFill: { height: 2, backgroundColor: color.text },
});
