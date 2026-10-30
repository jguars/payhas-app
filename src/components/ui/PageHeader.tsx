import { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { useT } from '@/i18n';
import { useGoBack } from '@/lib/useGoBack';
import { color, font, space, themedStyles, type } from '@/theme/tokens';

/**
 * The one header: a large title on the left, an optional line under it and an
 * optional action on the right. Pushed screens add `back`, which sits above
 * the title. Tab roots, parent screens and onboarding steps all use it.
 */
export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean; right?: ReactNode }) {
  const goBack = useGoBack();
  const { t } = useT();
  return (
    <View style={styles.wrap}>
      {back && (
        <View style={styles.backRow}>
          <IconButton icon="back" plain label={t('common.back')} onPress={() => goBack()} testID="header-back" />
        </View>
      )}
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {right}
      </View>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { gap: space.xs },
  backRow: { marginLeft: -space.md, marginBottom: space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { flex: 1, color: color.text, fontFamily: font.display, ...type.headline },
  subtitle: { color: color.text2, fontFamily: font.medium, ...type.body },
}));
