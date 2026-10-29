import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { useFamily } from '@/features/family/FamilyProvider';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { alpha, color, font, media, radius, size, space, themedStyles } from '@/theme/tokens';

import type { MediaSource } from './data';

/**
 * Free plan, after today's 30 videos: the next slot in the feed is a video
 * that won't play — a blurred poster with a lock and "Unlock with Plus". That
 * button opens Payhas Plus, which asks for the parent PIN first, so a child
 * can't buy anything and never sees a price here.
 */
export function LockedNext({ height, poster }: { height: number; poster?: MediaSource }) {
  const { current } = useFamily();
  const { t } = useT();
  const gamesOn = current?.games_enabled !== false;
  return (
    <View style={[styles.root, { height }]}>
      {poster != null && <Image source={poster} blurRadius={40} contentFit="cover" style={StyleSheet.absoluteFill} />}
      <View style={styles.scrim} />
      <View style={styles.body}>
        <Enter index={0}>
          <View style={styles.lock}>
            <Icon name="lock" size={40} color={media.text} strokeWidth={2.2} />
          </View>
        </Enter>
        <Enter index={1}>
          <Text style={styles.title}>{t('plus.capTitle')}</Text>
        </Enter>
        <Enter index={2}>
          <Text style={styles.sub}>{t('plus.capSub')}</Text>
        </Enter>
        <Enter index={3}>
          <PressScale
            onPress={() => {
              fx.tap();
              router.push('/plus');
            }}
            accessibilityRole="button"
            style={styles.unlock}
          >
            <Icon name="sparkle" size={20} color={color.ink} strokeWidth={2.4} />
            <Text style={styles.unlockText}>{t('plus.unlockWithPlus')}</Text>
          </PressScale>
        </Enter>
        {gamesOn && (
          <Enter index={4}>
            <Pressable onPress={() => router.navigate('/play')} accessibilityRole="button" hitSlop={8} style={styles.play}>
              <Icon name="game" size={18} color={media.text2} strokeWidth={2.2} />
              <Text style={styles.playText}>{t('nav.play')}</Text>
            </Pressable>
          </Enter>
        )}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { backgroundColor: color.ink, overflow: 'hidden' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: alpha(color.ink, 0.6) },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.xl },
  lock: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(media.text, 0.12), marginBottom: space.sm },
  title: { color: media.text, fontFamily: font.display, fontSize: size.heading, letterSpacing: -0.6, textAlign: 'center' },
  sub: { color: media.text2, fontFamily: font.medium, fontSize: size.body, lineHeight: 21, textAlign: 'center' },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 56, paddingHorizontal: space.xl, marginTop: space.md, borderRadius: radius.pill, backgroundColor: color.ember },
  unlockText: { color: color.ink, fontFamily: font.bold, fontSize: size.lead },
  play: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: space.lg },
  playText: { color: media.text2, fontFamily: font.semibold, fontSize: size.body },
}));
