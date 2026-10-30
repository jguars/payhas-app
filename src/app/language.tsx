import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { LanguagePicker, useChooseLanguage } from '@/components/LanguagePicker';
import { Enter } from '@/components/motion/Enter';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { LaneMark } from '@/features/start/LaneMark';
import { Lang, LANGS, translate, useT } from '@/i18n';
import { useInsets } from '@/lib/useInsets';
import { color, font, layout, pageFill, space, themedStyles, type } from '@/theme/tokens';

/**
 * First run, after Welcome: the language. It starts on the phone's own; a
 * tap only marks a row (the title follows it, so you see the pick working)
 * and Continue applies it — the router then moves on to sign-in.
 */
export default function LanguageScreen() {
  const insets = useInsets();
  const { lang } = useT();
  const choose = useChooseLanguage();
  const [picked, setPicked] = useState<Lang>(lang);
  const others = LANGS.filter((l) => l.code !== picked).map((l) => translate(l.code, 'onboarding.lang.title'));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm }]} showsVerticalScrollIndicator={false}>
        {router.canGoBack() && (
          <View style={styles.back}>
            <IconButton icon="back" label={translate(picked, 'common.back')} onPress={() => router.back()} />
          </View>
        )}
        <Enter index={0}>
          <LaneMark />
        </Enter>
        <Enter index={1}>
          <Text style={styles.title} accessibilityRole="header">
            {translate(picked, 'onboarding.lang.title')}
          </Text>
          <Text style={styles.others}>{others.join(' · ')}</Text>
        </Enter>
        <Enter index={2} style={styles.list}>
          <LanguagePicker value={picked} onChange={setPicked} />
        </Enter>
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: insets.bottom + space.xl }]}>
        <Button label={translate(picked, 'common.continue')} onPress={() => choose(picked, true)} />
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  content: { paddingHorizontal: layout.gutter, gap: space.lg },
  back: { marginLeft: -space.md, alignSelf: 'flex-start' },
  title: { color: color.text, fontFamily: font.display, ...type.headline },
  others: { color: color.text2, fontFamily: font.medium, ...type.small, marginTop: space.xs },
  list: { marginTop: space.sm },
  actions: { paddingHorizontal: layout.gutter, paddingTop: space.lg },
}));
