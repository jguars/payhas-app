import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SafeScreen } from '@/components/SafeScreen';
import { useFamily } from '@/features/family/FamilyProvider';
import { Constants, Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { color, font, radius, space } from '@/theme/tokens';

type Interest = Tables<'interests'>;
const laneRank = (l: Interest['youngest_lane']) => Constants.public.Enums.lane.indexOf(l);

/** Cold start: the active profile picks a few things it likes before its first feed. */
export default function InterestsScreen() {
  const { active, refresh } = useFamily();
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
      <Text style={styles.title}>{profile ? `What does ${profile.display_name} like?` : ''}</Text>
      <ScrollView contentContainerStyle={styles.grid}>
        {options.length === 0 && <ActivityIndicator color={color.text2} />}
        {options.map((i) => {
          const on = picked.has(i.slug);
          return (
            <Pressable
              key={i.slug}
              onPress={() => toggle(i.slug)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={i.label}
              style={[styles.tile, on && styles.tileOn]}
            >
              <Text style={styles.emoji}>{i.emoji}</Text>
              <Text style={[styles.label, on && styles.labelOn]}>{i.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.error}>{error ?? ' '}</Text>
        <Pressable onPress={save} disabled={picked.size === 0 || saving} style={[styles.button, (picked.size === 0 || saving) && styles.buttonOff]}>
          {saving ? <ActivityIndicator color={color.ink} /> : <Text style={styles.buttonText}>Done</Text>}
        </Pressable>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  title: { color: color.text, fontFamily: font.display, fontSize: 28, textAlign: 'center', paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.xl },
  tile: {
    width: 104,
    height: 104,
    borderRadius: radius.card,
    backgroundColor: color.surface1,
    borderWidth: 2,
    borderColor: color.surface1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  tileOn: { borderColor: color.ember, backgroundColor: color.surface2 },
  emoji: { fontSize: 36 },
  label: { color: color.text2, fontFamily: font.semibold, fontSize: 14 },
  labelOn: { color: color.text },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.sm },
  error: { color: color.ember, fontFamily: font.medium, fontSize: 13, textAlign: 'center' },
  button: { height: 52, borderRadius: radius.pill, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: color.ink, fontFamily: font.bold, fontSize: 16 },
});
