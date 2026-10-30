import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Icon, IconName } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { StatusScrim } from '@/components/StatusScrim';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ListGroup, ListRow } from '@/components/ui/List';
import { useFamily } from '@/features/family/FamilyProvider';
import { TKey, useT } from '@/i18n';
import { useGoBack } from '@/lib/useGoBack';
import { useInsets } from '@/lib/useInsets';
import { border, color, font, iconSize, iconStroke, layout, pageFill, radius, space, themedStyles, topicTints, type } from '@/theme/tokens';

const BENEFITS: { icon: IconName; label: TKey }[] = [
  { icon: 'play', label: 'plus.benefitVideos' },
  { icon: 'game', label: 'plus.benefitGames' },
  { icon: 'me', label: 'plus.benefitProfile' },
  { icon: 'clock', label: 'plus.benefitReports' },
];

/**
 * The Paywall (owner's mockup): reached from the locked video after the free
 * 30, by anyone. It shows what Plus adds and the monthly price; buying goes
 * through the parent PIN on the Payhas Plus page, so a child can look but
 * can't pay.
 */
export default function PaywallScreen() {
  const insets = useInsets();
  const goBack = useGoBack();
  const { plan } = useFamily();
  const { t } = useT();
  const price = plan?.price_tmt ?? 20;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <IconButton icon="close" label={t('common.close')} onPress={goBack} />
        </View>

        <Enter index={0} style={styles.hero}>
          <View style={styles.dots} aria-hidden>
            {topicTints.slice(1).map((c) => (
              <View key={c} style={[styles.dot, { backgroundColor: c }]} />
            ))}
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {t('plus.title')}
          </Text>
          <Text style={styles.sub}>{t('plus.paywallSub')}</Text>
        </Enter>

        <Enter index={1}>
          <ListGroup>
            {BENEFITS.map((b, i) => (
              <ListRow key={b.label} first={i === 0} icon={b.icon} label={t(b.label)} value={<Icon name="check" size={iconSize.md} color={color.success} strokeWidth={iconStroke(iconSize.md)} />} />
            ))}
          </ListGroup>
        </Enter>

        <Enter index={2}>
          <Card>
            <View style={styles.planRow} accessible accessibilityLabel={`${t('plus.monthly')}, ${t('plus.perMonthPrice', { price })}. ${t('plus.cancelAnytime')}`}>
              <View style={styles.planText}>
                <Text style={styles.planName}>{t('plus.monthly')}</Text>
                <Text style={styles.planSub}>{t('plus.cancelAnytime')}</Text>
              </View>
              <Text style={styles.price}>{t('plus.perMonthPrice', { price })}</Text>
            </View>
          </Card>
        </Enter>

        <Enter index={3} style={styles.cta}>
          {/* Buying happens on the Payhas Plus page, which asks for the parent PIN first. */}
          <Button label={t('plus.continuePin')} icon="lock" onPress={() => router.push('/plus')} />
          <Text style={styles.note}>{t('plus.parentBuys')}</Text>
        </Enter>
        <View style={styles.end} />
      </ScrollView>
      <StatusScrim />
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  // Fills the screen so the body can centre on tall phones (Pro Max); scrolls on the smallest (SE).
  content: { flexGrow: 1, paddingHorizontal: layout.gutter, gap: layout.section },
  // Equal flexible space above the body and below it centres the body on tall phones.
  top: { flexDirection: 'row', marginBottom: 'auto' },
  end: { marginTop: 'auto' },
  hero: { alignItems: 'center', gap: space.sm },
  dots: { flexDirection: 'row', gap: space.xs + border.strong },
  dot: { width: space.xl, height: space.sm, borderRadius: radius.pill },
  title: { color: color.text, fontFamily: font.display, ...type.display, textAlign: 'center', marginTop: space.sm },
  sub: { color: color.text2, fontFamily: font.medium, ...type.body, textAlign: 'center' },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  planText: { flexShrink: 1, gap: space.xs / 2 },
  planName: { color: color.text, fontFamily: font.bold, ...type.body },
  planSub: { color: color.text2, fontFamily: font.medium, ...type.small },
  price: { color: color.text, fontFamily: font.title, ...type.title },
  cta: { gap: space.md },
  note: { color: color.text3, fontFamily: font.medium, ...type.caption, textAlign: 'center' },
}));
