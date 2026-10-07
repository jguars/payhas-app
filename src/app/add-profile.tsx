import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PinPad } from '@/components/PinPad';
import { SafeScreen } from '@/components/SafeScreen';
import { useFamily } from '@/features/family/FamilyProvider';
import { supabase } from '@/lib/supabase';
import { color, font, Lane, lane as lanes, radius, space } from '@/theme/tokens';

const LANES: Lane[] = ['little', 'kids', 'teen', 'adult'];

export default function AddProfileScreen() {
  const { refresh } = useFamily();
  const [name, setName] = useState('');
  const [lane, setLane] = useState<Lane | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (confirming && lane) {
    return (
      <SafeScreen style={styles.root}>
        <View style={styles.center}>
          <PinPad
            title="Parent PIN"
            onCancel={() => setConfirming(false)}
            onComplete={async (pin) => {
              const { data, error } = await supabase.rpc('save_profile', { p_pin: pin, p_display_name: name.trim(), p_lane: lane });
              if (error) return error.message;
              if (!data) return false;
              await refresh();
              router.back();
              return true;
            }}
          />
        </View>
      </SafeScreen>
    );
  }

  const ready = name.trim().length > 0 && lane != null;

  return (
    <SafeScreen style={styles.root}>
      <View style={styles.center}>
        <TextInput
          style={styles.name}
          placeholder="Name"
          placeholderTextColor={color.text3}
          maxLength={30}
          autoFocus
          value={name}
          onChangeText={setName}
        />
        <View style={styles.lanes}>
          {LANES.map((key) => {
            const l = lanes[key];
            const on = lane === key;
            return (
              <Pressable
                key={key}
                onPress={() => setLane(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.lane, { borderColor: on ? l.color : color.line }, on && { backgroundColor: l.color + '22' }]}
              >
                <Text style={[styles.laneLabel, { color: on ? l.color : color.text }]}>{l.label}</Text>
                <Text style={styles.laneAges}>{l.ages}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Pressable onPress={() => setConfirming(true)} disabled={!ready} style={[styles.button, !ready && styles.buttonOff]}>
          <Text style={styles.buttonText}>Add</Text>
        </Pressable>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl, gap: space.xxl },
  name: { color: color.text, fontFamily: font.display, fontSize: 34, textAlign: 'center', paddingVertical: space.sm },
  lanes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' },
  lane: { width: 150, paddingVertical: space.lg, borderRadius: radius.card, borderWidth: 1.5, alignItems: 'center', gap: 2 },
  laneLabel: { fontFamily: font.bold, fontSize: 17 },
  laneAges: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.lg },
  cancel: { color: color.text2, fontFamily: font.semibold, fontSize: 15 },
  button: { height: 48, paddingHorizontal: space.xxl, borderRadius: radius.pill, backgroundColor: color.ember, justifyContent: 'center' },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: color.ink, fontFamily: font.bold, fontSize: 16 },
});
