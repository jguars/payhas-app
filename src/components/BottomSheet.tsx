import { ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useT } from '@/i18n';
import { useInsets } from '@/lib/useInsets';
import { dismissKeyboard } from '@/theme/ThemeProvider';
import { spring } from '@/theme/motion';
import { alpha, color, font, size, space, themedStyles } from '@/theme/tokens';

const TRAVEL = 700;

type Props = { open: boolean; onClose: () => void; title?: string; children: ReactNode };

/** Slides up over a dimmed screen; tap outside or back to close. Stays mounted through its exit. */
export function BottomSheet({ open, onClose, title, children }: Props) {
  const { bottom } = useInsets();
  const { t } = useT();
  const [visible, setVisible] = useState(open);
  const y = useSharedValue(TRAVEL);
  const dim = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setVisible(true);
      y.value = withSpring(0, spring.smooth);
      dim.value = withTiming(1, { duration: 200 });
    } else if (visible) {
      y.value = withTiming(TRAVEL, { duration: 200 });
      dim.value = withTiming(0, { duration: 200 });
      const t = setTimeout(() => setVisible(false), 210);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: dim.value }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Animated.View style={[styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.close')} />
      </Animated.View>
      {/* Sheets open in their own layer, so they close the keyboard on empty taps themselves. */}
      <Animated.View style={[styles.sheet, { paddingBottom: bottom + space.lg }, sheet]} onStartShouldSetResponder={dismissKeyboard}>
        <View style={styles.grabber} />
        {title && <Text style={styles.title}>{title}</Text>}
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: alpha(color.black, 0.55) },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.surface1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: space.md,
    gap: space.lg,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: color.line },
  title: { color: color.text, fontFamily: font.bold, fontSize: size.body, textAlign: 'center', marginTop: -space.xs },
}));
