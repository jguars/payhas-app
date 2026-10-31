import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { SafeScreen } from '@/components/SafeScreen';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { topicLabel, useT } from '@/i18n';
import { useFamily } from '@/features/family/FamilyProvider';
import { Constants, Tables } from '@/lib/database.types';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { color, font, pageFill, radius, size, space, themedStyles } from '@/theme/tokens';

type Interest = Tables<'interests'>;
const laneRank = (l: Interest['youngest_lane']) => Constants.public.Enums.lane.indexOf(l);

/** Cold start: the active profile picks a few things it likes before its first feed. */
export default function InterestsScreen() {
  const { active, refresh, leaveProfile } = useFamily();
  const { t } = useT();
  const [options, setOptions] = useState<Interest[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = active?.profile;

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('interests')
      .select('*')
      .order('sort')
      // The insert policy enforces this too; filtering here just hides what would be refused.
      .then(({ data }) => setOptions((data ?? []).filter((i) => laneRank(i.youngest_lane) <= laneRank(profile.lane))));
  }, [profile]);

  const toggle = (slug: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('profile_interests')
      .insert([...picked].map((slug) => ({ profile_id: profile.id, interest_slug: slug })));
    if (err) {
      setSaving(false);
      return setError(err.message);
    }
    await refresh(); // interestCount > 0 → the router moves on to the feed
  };

  return (
    <SafeScreen style={styles.root}>
      {/* Back to "Who's watching?", like "Not you?" below. */}
      <View style={styles.back}>
        <IconButton icon="back" label={t('common.back')} onPress={leaveProfile} />
      </View>
      <Enter index={0}>
        <Text style={styles.title} accessibilityRole="header">
          {profile ? t('onboarding.child.interestsTitle', { name: profile.display_name }) : ''}
        </Text>
      </Enter>
      <Enter index={1}>
        <Text style={styles.hint}>{t('onboarding.child.interestsHint')}</Text>
      </Enter>
      <ScrollView contentContainerStyle={styles.grid}>
        {options.length === 0 && <ActivityIndicator color={color.text2} />}
        {options.map((i, n) => (
          <Enter key={i.slug} index={2 + n} rise={8}>
            <Chip
              label={topicLabel(t, i.slug, i.label)}
              emoji={i.emoji}
              size="lg"
              selected={picked.has(i.slug)}
              onPress={() => toggle(i.slug)}
            />
          </Enter>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.error}>{error ?? ' '}</Text>
        <PressScale
          onPress={() => {
            fx.tap();
            save();
          }}
          disabled={picked.size === 0 || saving}
          accessibilityRole="button"
          style={[styles.button, (picked.size === 0 || saving) && styles.buttonOff]}
        >
          {saving ? <ActivityIndicator color={color.ink} /> : <Text style={styles.buttonText}>{t('common.done')}</Text>}
        </PressScale>
        <Pressable onPress={leaveProfile} hitSlop={10} accessibilityRole="button" style={styles.switch}>
          <Text style={styles.switchText}>{t('onboarding.notYou', { name: profile?.display_name ?? '' })}</Text>
        </Pressable>
      </View>
    </SafeScreen>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  back: { alignSelf: 'flex-start', marginLeft: space.sm, marginTop: space.sm },
  title: { color: color.text, fontFamily: font.display, fontSize: size.headline, lineHeight: 39, letterSpacing: -0.6, textAlign: 'center', paddingHorizontal: space.xl, paddingTop: space.sm },
  hint: { color: color.text2, fontFamily: font.medium, fontSize: size.body, textAlign: 'center', paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xl },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.sm },
  error: { color: color.danger, fontFamily: font.medium, fontSize: size.small, textAlign: 'center' },
  button: { height: 52, borderRadius: radius.pill, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: color.ink, fontFamily: font.bold, fontSize: size.body },
  switch: { alignSelf: 'center', minHeight: 48, justifyContent: 'center' },
  switchText: { color: color.text2, fontFamily: font.semibold, fontSize: size.small },
}));
