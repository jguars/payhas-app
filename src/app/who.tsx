import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { PressScale } from '@/components/motion/PressScale';
import { PinPad } from '@/components/PinPad';
import { SafeScreen } from '@/components/SafeScreen';
import { Avatar } from '@/components/ui/Avatar';
import { Profile, useFamily } from '@/features/family/FamilyProvider';
import { laneKey, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { color, font, space } from '@/theme/tokens';

const AVATAR = 104;
const TILE = 132;

export default function WhoScreen() {
  const { profiles, hasPin, selectProfile, refresh } = useFamily();
  const { t } = useT();
  const [pinFor, setPinFor] = useState<Profile | null>(null);

  // First run: the parent sets a PIN before anything else.
  if (!hasPin) {
    return (
      <SafeScreen style={styles.root}>
        <View style={styles.center}>
          <PinPad
            title={t('auth.setPin')}
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

  const pick = (p: Profile) => {
    fx.tap();
    if (p.pin_protected) setPinFor(p);
    else selectProfile(p);
  };

  return (
    <SafeScreen style={styles.root}>
      <View style={styles.center}>
        <Enter>
          <Text style={styles.title}>{t('auth.whoTitle')}</Text>
        </Enter>
        <View style={styles.grid}>
          {profiles.map((p, i) => {
            const laneName = t(laneKey(p.lane));
            return (
              <Enter key={p.id} index={i + 1}>
                <PressScale
                  onPress={() => pick(p)}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.profileA11y', { name: p.display_name, lane: laneName })}
                  style={styles.tile}
                >
                  <Avatar name={p.display_name} avatar={p.avatar} lane={p.lane} size={AVATAR} locked={p.pin_protected} ribbon={laneName.toUpperCase()} />
                  <Text style={styles.name} numberOfLines={1}>
                    {p.display_name}
                  </Text>
                </PressScale>
              </Enter>
            );
          })}
          {profiles.length < 6 && (
            <Enter index={profiles.length + 1}>
              <PressScale
                onPress={() => {
                  fx.tap();
                  router.push('/add-child');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('auth.addProfile')}
                style={styles.tile}
              >
                <View style={styles.add}>
                  <Icon name="plus" size={36} color={color.text2} strokeWidth={2} />
                </View>
                <Text style={[styles.name, styles.addName]} numberOfLines={1}>
                  {t('auth.addProfile')}
                </Text>
              </PressScale>
            </Enter>
          )}
        </View>
      </View>
      <View style={styles.footer}>
        <PressScale
          onPress={() => {
            fx.tap();
            router.push('/parent');
          }}
          hitSlop={10}
          pressedScale={0.94}
          style={styles.footerButton}
          accessibilityRole="button"
        >
          <Icon name="sliders" size={15} color={color.text3} strokeWidth={2.2} />
          <Text style={styles.footerText}>{t('auth.dashboardSignOut')}</Text>
        </PressScale>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, gap: space.xxxl },
  title: { color: color.text, fontFamily: font.display, fontSize: 30, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: space.xl, rowGap: space.xxl, width: TILE * 2 + space.xl },
  tile: { width: TILE, alignItems: 'center', gap: space.md },
  add: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  name: { color: color.text, fontFamily: font.semibold, fontSize: 16, maxWidth: TILE },
  addName: { color: color.text2 },
  footer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: space.lg },
  footerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: space.md },
  footerText: { color: color.text3, fontFamily: font.medium, fontSize: 14 },
});
