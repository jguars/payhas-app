import { ReactNode, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { useInsets } from '@/lib/useInsets';
import { spring } from '@/theme/motion';
import { color, font, pageFill, radius, space, themedStyles } from '@/theme/tokens';

type Props = {
  /** 0–1 across the whole flow; the bar slides to it. */
  progress?: number;
  title?: string;
  hint?: string;
  onBack?: () => void;
  /** The primary button; hidden when absent. */
  action?: { label: string; onPress: () => void; disabled?: boolean };
  /** A quiet secondary button under the primary one. */
  secondary?: { label: string; onPress: () => void };
  children?: ReactNode;
  /** Remount key: content enters again when it changes. */
  stepKey: string;
};

/** One onboarding step: back + progress on top, a title, content, one clear button at the bottom. */
export function Step({ progress, title, hint, onBack, action, secondary, children, stepKey }: Props) {
  const { t } = useT();
  const insets = useInsets();
  const p = useSharedValue(progress ?? 0);
  useEffect(() => {
    if (progress != null) p.value = withSpring(progress, spring.smooth);
  }, [progress, p]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.02, p.value) }] }));

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top + 8 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.top}>
        {onBack ? (
          <PressScale
            onPress={() => {
              fx.tap();
              onBack();
            }}
            pressedScale={0.88}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={styles.back}
          >
            <Icon name="back" size={22} strokeWidth={2.4} />
          </PressScale>
        ) : (
          <View style={styles.back} />
        )}
        {progress != null && (
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { transformOrigin: 'left' }, bar]} />
          </View>
        )}
        <View style={styles.back} />
      </View>

      <ScrollView key={stepKey} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!!title && (
          <Enter index={0}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          </Enter>
        )}
        {!!hint && (
          <Enter index={1}>
            <Text style={styles.hint}>{hint}</Text>
          </Enter>
        )}
        <Enter index={2} style={{ gap: space.md }}>
          {children}
        </Enter>
      </ScrollView>

      {(action || secondary) && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
          {action && (
            <PressScale
              onPress={() => {
                fx.tap();
                action.onPress();
              }}
              disabled={action.disabled}
              accessibilityRole="button"
              style={[styles.button, action.disabled && { opacity: 0.4 }]}
            >
              <Text style={styles.buttonText} numberOfLines={2} maxFontSizeMultiplier={1.4}>{action.label}</Text>
            </PressScale>
          )}
          {secondary && (
            <PressScale onPress={secondary.onPress} accessibilityRole="button" style={styles.secondary}>
              <Text style={styles.secondaryText}>{secondary.label}</Text>
            </PressScale>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: color.surface2, overflow: 'hidden' },
  fill: { height: 6, width: '100%', borderRadius: 3, backgroundColor: color.ember },
  content: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xxl, gap: space.md },
  title: { color: color.text, fontFamily: font.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  hint: { color: color.text2, fontFamily: font.medium, fontSize: 15, lineHeight: 21, marginBottom: space.sm },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.sm },
  button: { minHeight: 56, paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: color.ink, fontFamily: font.bold, fontSize: 17 },
  secondary: { height: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: color.text2, fontFamily: font.semibold, fontSize: 15 },
}));
