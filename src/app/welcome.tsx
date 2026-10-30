import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Enter } from '@/components/motion/Enter';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { firstRun } from '@/features/start/firstRun';
import { useT } from '@/i18n';
import { useInsets } from '@/lib/useInsets';
import { color, control, font, layout, pageFill, radius, space, themedStyles, type } from '@/theme/tokens';

const SHOTS = [require('../../assets/welcome/a.jpg'), require('../../assets/welcome/b.jpg'), require('../../assets/welcome/c.jpg'), require('../../assets/welcome/d.jpg')];

/** The bear in the middle of the collage, ringed in the page colour so it sits on all four shots. */
const MASCOT = control.lg * 2 + space.sm;

/**
 * First screen on a new phone, after the splash: what Payhas is, in the
 * phone's own language, then one way in. Both buttons lead to the language
 * step; the choice decides whether sign-in opens on a new account.
 */
export default function WelcomeScreen() {
  const insets = useInsets();
  const { t } = useT();
  const go = (signUp: boolean) => {
    firstRun.signUp = signUp;
    router.push('/language');
  };
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]} showsVerticalScrollIndicator={false}>
        <Enter index={0}>
          <View style={styles.collage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.grid}>
              {[SHOTS.slice(0, 2), SHOTS.slice(2)].map((pair, r) => (
                <View key={r} style={styles.gridRow}>
                  {pair.map((src, i) => (
                    <Image key={i} source={src} style={styles.shot} contentFit="cover" />
                  ))}
                </View>
              ))}
            </View>
            <View style={styles.mascot}>
              <Avatar name="Payhas" avatar="bear" lane="kids" size={MASCOT} />
            </View>
          </View>
        </Enter>
        <Enter index={1}>
          <Text style={styles.title} accessibilityRole="header">
            {t('onboarding.start.title')}
          </Text>
        </Enter>
        <Enter index={2}>
          <Text style={styles.body}>{t('onboarding.start.body')}</Text>
        </Enter>
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: insets.bottom + space.xl }]}>
        <Button label={t('onboarding.start.go')} onPress={() => go(true)} />
        <Button label={t('onboarding.start.haveAccount')} variant="secondary" onPress={() => go(false)} />
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  content: { paddingHorizontal: layout.gutter, gap: space.md },
  collage: { aspectRatio: 1, maxHeight: layout.maxContent, marginBottom: space.lg, alignItems: 'center', justifyContent: 'center' },
  grid: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, gap: space.sm },
  gridRow: { flex: 1, flexDirection: 'row', gap: space.sm },
  shot: { flex: 1, borderRadius: radius.md, backgroundColor: color.surface1 },
  mascot: { borderRadius: radius.pill, borderWidth: space.sm, borderColor: color.bg },
  title: { color: color.text, fontFamily: font.display, ...type.headline },
  body: { color: color.text2, fontFamily: font.medium, ...type.body },
  actions: { paddingHorizontal: layout.gutter, paddingTop: space.lg, gap: space.md },
}));
