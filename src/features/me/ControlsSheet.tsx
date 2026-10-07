import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useInsets } from '@/lib/useInsets';

import { Toggle } from '@/components/motion/Toggle';
import { PinPad } from '@/components/PinPad';
import { PressScale } from '@/components/motion/PressScale';
import { Profile, useFamily } from '@/features/family/FamilyProvider';
import { QUIET_END_HOUR, QUIET_START_HOUR } from '@/features/library/useScreenTime';
import { supabase } from '@/lib/supabase';
import { spring } from '@/theme/motion';
import { color, font, radius, space } from '@/theme/tokens';

const LIMITS: (number | null)[] = [null, 15, 30, 45, 60, 90];
const SHEET_TRAVEL = 640;

type Props = { profile: Profile; open: boolean; onClose: () => void };

/** Bottom sheet for daily limit + quiet hours. Choose, then confirm with the parent PIN. */
export function ControlsSheet({ profile, open, onClose }: Props) {
  const insets = useInsets();
  const { refresh } = useFamily();
  const [limit, setLimit] = useState<number | null>(profile.daily_limit_minutes);
  const [quiet, setQuiet] = useState(profile.quiet_hours);
  const [confirming, setConfirming] = useState(false);
  const [visible, setVisible] = useState(open);

  const y = useSharedValue(SHEET_TRAVEL);
  const dim = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setLimit(profile.daily_limit_minutes);
      setQuiet(profile.quiet_hours);
      setConfirming(false);
      setVisible(true);
      y.value = withSpring(0, spring.smooth);
      dim.value = withTiming(1, { duration: 220 });
    } else if (visible) {
      y.value = withTiming(SHEET_TRAVEL, { duration: 220 });
      dim.value = withTiming(0, { duration: 220 });
      const t = setTimeout(() => setVisible(false), 230);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: dim.value }));

  const changed = limit !== profile.daily_limit_minutes || quiet !== profile.quiet_hours;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }, sheet]}>
        <View style={styles.grabber} />
        {confirming ? (
          <PinPad
            title="Parent PIN"
            onCancel={() => setConfirming(false)}
            onComplete={async (pin) => {
              const { data, error } = await supabase.rpc('save_controls', {
                p_pin: pin,
                p_profile_id: profile.id,
                p_daily_limit_minutes: limit,
                p_quiet_hours: quiet,
              });
              if (error) return error.message;
              if (!data) return false;
              await refresh();
              onClose();
              return true;
            }}
          />
        ) : (
          <View style={{ gap: space.xl }}>
            <Text style={styles.title}>{profile.display_name}'s controls</Text>

            <View style={{ gap: space.md }}>
              <Text style={styles.label}>Daily limit</Text>
              <Segmented value={limit} onChange={setLimit} />
            </View>

            <Pressable onPress={() => setQuiet((q) => !q)} style={styles.quietRow} accessibilityRole="switch" accessibilityState={{ checked: quiet }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.label}>Quiet hours</Text>
                <Text style={styles.sub}>
                  {QUIET_START_HOUR - 12}pm – {QUIET_END_HOUR}am
                </Text>
              </View>
              <Toggle on={quiet} />
            </Pressable>

            <PressScale
              onPress={() => setConfirming(true)}
              disabled={!changed}
              accessibilityRole="button"
              style={[styles.save, !changed && { opacity: 0.4 }]}
            >
              <Text style={styles.saveText}>Save</Text>
            </PressScale>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

/** Six options with a pill that slides to the chosen one. */
function Segmented({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, LIMITS.indexOf(value));
  const x = useSharedValue(index);
  useEffect(() => {
    x.value = withSpring(index, spring.snappy);
  }, [index, x]);
  const seg = width / LIMITS.length;
  const pill = useAnimatedStyle(() => ({ width: seg, transform: [{ translateX: x.value * seg }] }));

  return (
    <View style={styles.segments} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)} accessibilityRole="radiogroup">
      {width > 0 && <Animated.View style={[styles.segPill, pill]} />}
      {LIMITS.map((l) => {
        const on = l === value;
        return (
          <Pressable key={String(l)} onPress={() => onChange(l)} style={styles.seg} accessibilityRole="radio" accessibilityState={{ selected: on }}>
            <Text style={[styles.segText, on && styles.segTextOn]}>{l == null ? 'Off' : l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.surface1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.lg,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: color.line, marginBottom: space.sm },
  title: { color: color.text, fontFamily: font.title, fontSize: 22 },
  label: { color: color.text, fontFamily: font.semibold, fontSize: 15 },
  sub: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  segments: { flexDirection: 'row', height: 44, padding: 4, borderRadius: 14, backgroundColor: color.ink },
  segPill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 10, backgroundColor: color.surface2, borderWidth: 1, borderColor: color.line },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segText: { color: color.text3, fontFamily: font.mono, fontSize: 13 },
  segTextOn: { color: color.text },
  save: { height: 52, borderRadius: radius.pill, backgroundColor: color.ember, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: color.ink, fontFamily: font.bold, fontSize: 16 },
});
