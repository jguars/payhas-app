import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { PressScale } from '@/components/motion/PressScale';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { Avatar, AVATARS, avatarFor } from '@/components/ui/Avatar';
import { Chip } from '@/components/ui/Chip';
import { useFamily } from '@/features/family/FamilyProvider';
import { laneForBirth } from '@/features/onboarding/ChildSetup';
import { ParentSessionProvider, useParentSession } from '@/features/onboarding/ParentSession';
import { currentParentToken } from '@/features/parent/useParent';
import { laneKey, roleKey, TKey, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useGoBack } from '@/lib/useGoBack';
import { useInsets } from '@/lib/useInsets';
import { color, font, lane as lanes, pageFill, radius, size, space, themedStyles } from '@/theme/tokens';

/** The animals a parent can pick ('cat' means "not chosen yet": the name picks one). */
const CHOICES = AVATARS.filter((a) => a !== 'cat');

/**
 * Edit a profile: name, avatar and — for a child — birth month, which sets the
 * lane as in onboarding. Behind the parent PIN (reuses the dashboard's open
 * session). Opened from the Family dashboard and from Me.
 */
export default function ProfileEditScreen() {
  return (
    <ParentSessionProvider>
      <ProfileEdit />
    </ParentSessionProvider>
  );
}

function ProfileEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profiles, refresh } = useFamily();
  const gate = useParentSession();
  const goBack = useGoBack();
  const toast = useToast();
  const { bottom } = useInsets();
  const { t } = useT();
  const profile = profiles.find((p) => p.id === id);
  const [unlocked, setUnlocked] = useState(false);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [avatar, setAvatar] = useState<string>(profile ? avatarFor(profile.avatar, profile.display_name) : 'bear');
  const born = profile?.birth_month ? new Date(profile.birth_month + 'T12:00:00') : null;
  const [year, setYear] = useState<number | null>(born?.getFullYear() ?? null);
  const [month, setMonth] = useState<number | null>(born ? born.getMonth() + 1 : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const open = currentParentToken();
    if (open) gate.adopt(open);
    gate.ensure().then((token) => (token ? setUnlocked(true) : goBack()));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!unlocked || !profile) return <View style={styles.root} />;

  const child = !profile.is_parent && profile.lane !== 'adult';
  const now = new Date();
  const years = Array.from({ length: 18 }, (_, i) => now.getFullYear() - i);
  const newLane = child && year && month ? laneForBirth(year, month) : profile.lane;
  const birthChanged = child && year && month && (!born || born.getFullYear() !== year || born.getMonth() + 1 !== month);
  const ready = name.trim().length > 0 && !busy;

  const save = async () => {
    setBusy(true);
    setError(null);
    const token = await gate.ensure();
    if (!token) return setBusy(false);
    const { error: e } = await supabase.rpc('update_profile', {
      p_parent: token,
      p_profile_id: profile.id,
      p_name: name.trim(),
      p_avatar: avatar,
      p_birth_month: birthChanged ? `${year}-${String(month).padStart(2, '0')}-01` : null,
    });
    setBusy(false);
    if (e) {
      fx.error();
      if (e.code === '42501') gate.invalidate();
      return setError(t('onboarding.error.generic'));
    }
    fx.success();
    await refresh();
    toast({ text: t('parent.savedToast', { name: name.trim() }), icon: 'check' });
    if (router.canGoBack()) router.back();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('parent.editProfile')} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + space.xxl }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Avatar name={name || profile.display_name} avatar={avatar} lane={newLane} size={112} />
          <Text style={styles.role}>{profile.is_parent ? t(roleKey(profile)) : `${t(laneKey(newLane))} · ${lanes[newLane].ages}`}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('parent.avatarLabel')}</Text>
          <View style={styles.avatars}>
            {CHOICES.map((a) => {
              const on = avatar === a;
              return (
                <PressScale
                  key={a}
                  onPress={() => {
                    fx.tap();
                    setAvatar(a);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={a}
                  style={[styles.avatarChoice, on && { borderColor: color.ember }]}
                >
                  <Avatar name={name || profile.display_name} avatar={a} lane={newLane} size={52} />
                </PressScale>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('parent.nameLabel')}</Text>
          <TextInput
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError(null);
            }}
            maxLength={30}
            autoCorrect={false}
            placeholderTextColor={color.text3}
            style={styles.input}
            accessibilityLabel={t('parent.nameLabel')}
          />
        </View>

        {child && (
          <View style={styles.field}>
            <Text style={styles.label}>{t('parent.birthLabel')}</Text>
            <Text style={styles.sub}>{t('onboarding.child.year')}</Text>
            <View style={styles.chips}>
              {years.map((y) => (
                <Chip key={y} label={String(y)} selected={year === y} accessibilityRole="radio" onPress={() => setYear(y)} />
              ))}
            </View>
            <Text style={styles.sub}>{t('onboarding.child.month')}</Text>
            <View style={styles.chips}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const future = year === now.getFullYear() && m > now.getMonth() + 1;
                return <Chip key={m} label={t(`onboarding.m${m}` as TKey)} selected={month === m} disabled={future} accessibilityRole="radio" onPress={() => setMonth(m)} />;
              })}
            </View>
            {newLane !== profile.lane && (
              <Text style={styles.notice}>{t('parent.laneMove', { name: name || profile.display_name, lane: t(laneKey(newLane)), ages: lanes[newLane].ages })}</Text>
            )}
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
        <PressScale onPress={save} disabled={!ready} accessibilityRole="button" accessibilityState={{ disabled: !ready }} style={[styles.save, !ready && { opacity: 0.4 }]}>
          <Text style={styles.saveText}>{busy ? '…' : t('common.save')}</Text>
        </PressScale>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  content: { paddingHorizontal: space.lg, gap: space.xl },
  hero: { alignItems: 'center', gap: space.sm },
  role: { color: color.text2, fontFamily: font.semibold, fontSize: size.small },
  field: { gap: space.sm },
  label: { color: color.text, fontFamily: font.title, fontSize: size.lead },
  sub: { color: color.text3, fontFamily: font.semibold, fontSize: size.small },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  avatarChoice: { padding: 4, borderRadius: 34, borderWidth: 2.5, borderColor: 'transparent' },
  input: { color: color.text, fontFamily: font.semibold, fontSize: size.lead, minHeight: 56, paddingHorizontal: space.lg, borderRadius: 16, backgroundColor: color.surface1, borderWidth: 1.5, borderColor: color.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  notice: { color: color.warning, fontFamily: font.semibold, fontSize: size.small, lineHeight: 18 },
  error: { color: color.danger, fontFamily: font.semibold, fontSize: size.small, textAlign: 'center' },
  save: { height: 56, borderRadius: radius.pill, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: color.ink, fontFamily: font.bold, fontSize: size.lead },
}));
