import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { color, font } from '@/theme/tokens';

import { FeedVideo, formatCount } from './data';

type Props = { video: FeedVideo; active: boolean; height: number };

function FeedItemBase({ video, active, height }: Props) {
  const player = useVideoPlayer(video.source, (p) => {
    p.loop = true;
    // Browsers block autoplay with sound; native starts unmuted.
    p.muted = Platform.OS === 'web';
    p.timeUpdateEventInterval = 0.25;
  });

  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  const time = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const progress = player.duration > 0 ? Math.min(1, time.currentTime / player.duration) : 0;

  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (active) {
      player.currentTime = 0;
      player.play();
    } else {
      player.pause();
    }
  }, [active, player]);

  const onTap = () => {
    if (muted) player.muted = false;
    else if (player.playing) player.pause();
    else player.play();
  };

  return (
    <View style={[styles.root, { height }]}>
      <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} playsInline />
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap} accessibilityLabel={muted ? 'Unmute' : 'Play or pause'} />

      <View pointerEvents="none" style={styles.scrimBottom} />

      {muted && (
        <View pointerEvents="none" style={styles.mutedHint}>
          <Icon name="muted" size={16} />
          <Text style={styles.mutedText}>Tap for sound</Text>
        </View>
      )}

      <View style={styles.rail}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{video.creator.name[0]}</Text>
          </View>
          {!following && (
            <Pressable style={styles.follow} onPress={() => setFollowing(true)} accessibilityLabel={`Follow ${video.creator.name}`} hitSlop={10}>
              <Icon name="plus" size={12} color={color.ink} strokeWidth={3.5} />
            </Pressable>
          )}
        </View>
        <Pressable style={styles.action} onPress={() => setLiked((v) => !v)} accessibilityLabel="Like" accessibilityState={{ selected: liked }}>
          <Icon name="heart" size={32} color={liked ? color.ember : color.text} filled={liked} strokeWidth={1.9} />
          <Text style={styles.count}>{formatCount(video.likes + (liked ? 1 : 0))}</Text>
        </Pressable>
        <Pressable style={styles.action} accessibilityLabel="Comments">
          <Icon name="comment" size={30} strokeWidth={1.9} />
          <Text style={styles.count}>{formatCount(video.comments)}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => setSaved((v) => !v)} accessibilityLabel="Save" accessibilityState={{ selected: saved }}>
          <Icon name="save" size={28} filled={saved} strokeWidth={1.9} />
        </Pressable>
        <Pressable style={styles.action} accessibilityLabel="Share">
          <Icon name="share" size={28} strokeWidth={1.9} />
        </Pressable>
      </View>

      <View style={styles.meta} pointerEvents="box-none">
        <View style={styles.creatorRow}>
          <Text style={styles.creator}>{video.creator.name}</Text>
          {video.creator.verified && <Icon name="verified" size={15} color={color.verified} />}
        </View>
        <Text style={styles.caption} numberOfLines={1}>
          {video.caption}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
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
    height: 220,
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
  rail: { position: 'absolute', right: 12, bottom: 96, alignItems: 'center', gap: 20 },
  avatarWrap: { width: 46, height: 54, alignItems: 'center' },
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
  follow: {
    position: 'absolute',
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: color.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  count: { color: color.text, fontFamily: font.mono, fontSize: 12 },
  meta: { position: 'absolute', left: 16, right: 84, bottom: 22, gap: 6 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  creator: { color: color.text, fontFamily: font.bold, fontSize: 16 },
  caption: { color: color.text, fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: 'rgba(244,243,239,0.2)' },
  progressFill: { height: 2, backgroundColor: color.text },
});
