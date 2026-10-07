import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PinPad } from '@/components/PinPad';
import { SafeScreen } from '@/components/SafeScreen';
import { Profile, useFamily } from '@/features/family/FamilyProvider';
import { supabase } from '@/lib/supabase';
import { color, font, lane as lanes, space } from '@/theme/tokens';

export default function WhoScreen() {
  const { profiles, hasPin, selectProfile, refresh, signOut } = useFamily();
  const [pinFor, setPinFor] = useState<Profile | null>(null);

  // First run: the parent sets a PIN before anything else.
  if (!hasPin) {
    return (
      <SafeScreen style={styles.root}>
        <View style={styles.center}>
          <PinPad
            title="Set a parent PIN"
            onComplete={async (pin) => {
              const { data, error } = await supabase.rpc('set_parent_pin', { p_new_pin: pin });
              if (error) return error.message;
              await refresh();
              return !!data;
            }}
          />
        </View>
      </SafeScreen>
    );
  }

  if (pinFor) {
    return (
      <SafeScreen style={styles.root}>
        <View style={styles.center}>
          <PinPad title={pinFor.display_name} onComplete={(pin) => selectProfile(pinFor, pin)} onCancel={() => setPinFor(null)} />
        </View>
      </SafeScreen>
    );
  }

  const pick = (p: Profile) => (p.pin_protected ? setPinFor(p) : selectProfile(p));

  return (
    <SafeScreen style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.title}>Who's watching?</Text>
        <View style={styles.grid}>
          {profiles.map((p) => {
            const l = lanes[p.lane];
            return (
              <Pressable key={p.id} onPress={() => pick(p)} accessibilityLabel={`${p.display_name}, ${l.label} lane`} style={styles.tile}>
                <View style={[styles.avatar, { backgroundColor: l.color }]}>
                  <Text style={styles.avatarLetter}>{p.display_name[0]?.toUpperCase()}</Text>
                  {p.pin_protected && (
                    <View style={styles.lock}>
                      <Icon name="shield" size={12} color={color.text} strokeWidth={2.6} />
                    </View>
                  )}
                </View>
                <Text style={styles.name} numberOfLines={1}>{p.display_name}</Text>
              </Pressable>
            );
          })}
          {profiles.length < 6 && (
            <Pressable onPress={() => router.push('/add-profile')} accessibilityLabel="Add profile" style={styles.tile}>
              <View style={[styles.avatar, styles.add]}>
                <Icon name="plus" size={30} color={color.text2} strokeWidth={2.4} />
              </View>
              <Text style={[styles.name, { color: color.text3 }]}>Add</Text>
            </Pressable>
          )}
        </View>
      </View>
      <Pressable onPress={signOut} hitSlop={10} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, gap: space.xxl },
  title: { color: color.text, fontFamily: font.display, fontSize: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xl, maxWidth: 340 },
  tile: { width: 92, alignItems: 'center', gap: space.sm },
  avatar: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: color.ink, fontFamily: font.display, fontSize: 34 },
  lock: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: color.surface2,
    borderWidth: 2,
    borderColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: { backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line },
  name: { color: color.text, fontFamily: font.semibold, fontSize: 15 },
  signOut: { alignSelf: 'center', paddingVertical: space.lg },
  signOutText: { color: color.text3, fontFamily: font.semibold, fontSize: 14 },
});
