import { router } from 'expo-router';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { alpha, control, font, iconSize, iconStroke, media, radius, space, themedStyles, type } from '@/theme/tokens';

import type { MediaSource } from './data';

/**
 * Free plan, after today's 30 videos (owner's mockup): the feed still scrolls
 * to one more slot — a blurred poster that won't play, with a lock, "That's 30
 * videos for today" and "Unlock more videos", which opens the Paywall.
 * Swiping back rewatches what's already there.
 */
export function LockedNext({ height, poster }: { height: number; poster?: MediaSource }) {
  const { t } = useT();
  return (
    <View style={[styles.root, { height }]}>
      {poster != null && <Image source={poster} blurRadius={40} contentFit="cover" style={StyleSheet.absoluteFill} alt="" accessible={false} aria-hidden />}
      <View style={styles.scrim} />
      <View style={styles.body}>
        <Enter index={0}>
          <View style={styles.lock}>
            <Icon name="lock" size={iconSize.xl + space.sm} color={media.text} strokeWidth={iconStroke(iconSize.xl)} />
          </View>
        </Enter>
        <Enter index={1}>
          <Text style={styles.title} accessibilityRole="header">
            {t('plus.capTitle')}
          </Text>
        </Enter>
        <Enter index={2}>
          <Text style={styles.sub}>{t('plus.capSub')}</Text>
        </Enter>
        <Enter index={3} style={styles.cta}>
          <Button
            label={t('plus.unlockMore')}
            onPress={() => {
              fx.tap();
              router.push('/paywall');
            }}
          />
        </Enter>
        <Enter index={4}>
          <Text style={styles.hint}>{t('plus.rewatch')}</Text>
        </Enter>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { backgroundColor: media.scrim, overflow: 'hidden' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: alpha(media.scrim, 0.6) },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.xl },
  lock: { width: control.lg + space.xl, height: control.lg + space.xl, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(media.text, 0.12), marginBottom: space.sm },
  title: { color: media.text, fontFamily: font.display, ...type.headline, textAlign: 'center' },
  sub: { color: media.text2, fontFamily: font.medium, ...type.body, textAlign: 'center' },
  cta: { alignSelf: 'stretch', marginTop: space.md },
  hint: { color: media.text3, fontFamily: font.medium, ...type.small, textAlign: 'center' },
}));
