import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { useT } from '@/i18n';
import { useInsets } from '@/lib/useInsets';
import { useGoBack } from '@/lib/useGoBack';
import { color, font, space } from '@/theme/tokens';

/** Back chevron + centred title, for screens pushed on top of the tabs. */
export function ScreenHeader({ title }: { title: string }) {
  const { top } = useInsets();
  const goBack = useGoBack();
  const { t } = useT();
  return (
    <View style={[styles.bar, { paddingTop: top + 6 }]}>
      <PressScale onPress={() => goBack()} pressedScale={0.88} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
        <Icon name="back" size={22} strokeWidth={2.4} />
      </PressScale>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingBottom: space.sm },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { color: color.text, fontFamily: font.bold, fontSize: 17 },
});
