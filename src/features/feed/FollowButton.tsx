import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { useLibrary } from '@/features/library/LibraryProvider';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { spring } from '@/theme/motion';
import { alpha, color, font, radius } from '@/theme/tokens';

/** Worklets can't call plain JS helpers like `alpha()` on the UI thread, so resolve colours up here. */
const CLEAR = alpha(color.black, 0);

/** Follow ⇄ Following. The fill drains from ember to outline and the label swaps with a little bounce. */
export function FollowButton({ creator, size = 'md' }: { creator: string; size?: 'sm' | 'md' }) {
  const { following, toggleFollow } = useLibrary();
  const { t } = useT();
  const on = following.has(creator);
  const p = useSharedValue(on ? 1 : 0);
  const s = useSharedValue(1);

  useEffect(() => {
    p.value = withTiming(on ? 1 : 0, { duration: 220 });
  }, [on, p]);

  const anim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [color.ember, CLEAR]),
    borderColor: interpolateColor(p.value, [0, 1], [color.ember, color.line]),
    transform: [{ scale: s.value }],
  }));

  const h = size === 'sm' ? 36 : 46;
  return (
    <PressScale
      onPress={() => {
        s.value = withSequence(withTiming(0.92, { duration: 80 }), withSpring(1, spring.bouncy));
        if (on) fx.tap();
        else fx.follow();
        toggleFollow(creator);
      }}
      accessibilityRole="button"
      accessibilityLabel={on ? t('feed.unfollowName', { name: creator }) : t('feed.followName', { name: creator })}
    >
      <Animated.View style={[styles.button, { height: h, paddingHorizontal: size === 'sm' ? 14 : 22 }, anim]}>
        {on && <Icon name="check" size={16} color={color.text} strokeWidth={2.8} />}
        <Text style={[styles.text, { color: on ? color.text : color.ink, fontSize: size === 'sm' ? 13 : 15 }]} numberOfLines={1}>{on ? t('feed.following') : t('feed.follow')}</Text>
      </Animated.View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.pill, borderWidth: 1.5 },
  text: { fontFamily: font.bold },
});
