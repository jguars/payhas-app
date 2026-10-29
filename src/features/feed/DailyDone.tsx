import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { useFamily } from '@/features/family/FamilyProvider';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { alpha, color, font, radius, space } from '@/theme/tokens';

/**
 * The last "video" of the day on the Free plan: a full-height card that says
 * come back tomorrow and points at Play. It speaks to the child, so there's no
 * price and no upgrade — the parent sees Plus in the dashboard.
 */
export function DailyDone({ height }: { height: number }) {
  const { current } = useFamily();
  const { t } = useT();
  const gamesOn = current?.games_enabled !== false;
  return (
    <View style={[styles.root, { height }]}>
      <Enter index={0}>
        <View style={styles.art}>
          <Icon name="sparkle" size={48} color={color.reward} strokeWidth={2} />
        </View>
      </Enter>
      <Enter index={1}>
        <Text style={styles.title}>{t('plus.doneTitle')}</Text>
      </Enter>
      <Enter index={2}>
        <Text style={styles.body}>{t('plus.doneSub')}</Text>
      </Enter>
      {gamesOn && (
        <Enter index={3}>
          <PressScale
            onPress={() => {
              fx.tap();
              router.navigate('/play');
            }}
            accessibilityRole="button"
            style={styles.button}
          >
            <Icon name="game" size={22} color={color.ink} strokeWidth={2.4} />
            <Text style={styles.buttonText}>{t('nav.play')}</Text>
          </PressScale>
        </Enter>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.xl, backgroundColor: color.ink },
  art: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(color.reward, 0.12), marginBottom: space.sm },
  title: { color: color.text, fontFamily: font.display, fontSize: 28, letterSpacing: -0.6, textAlign: 'center' },
  body: { color: color.text2, fontFamily: font.medium, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 56, paddingHorizontal: space.xl, marginTop: space.md, borderRadius: radius.pill, backgroundColor: color.ember },
  buttonText: { color: color.ink, fontFamily: font.bold, fontSize: 17 },
});
