import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { PinPad } from '@/components/PinPad';
import { useToast } from '@/components/Toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFamily } from '@/features/family/FamilyProvider';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useGoBack } from '@/lib/useGoBack';
import { useInsets } from '@/lib/useInsets';
import { color, font, layout, pageFill, space, themedStyles, type } from '@/theme/tokens';

/**
 * A child's own phone leaving the family, always behind the parent PIN so a
 * child can't sign out and start a family of their own:
 * "Delete my account" (?leave absent) deletes the child's profile and
 * everything in it (delete_my_profile); "Sign out of this phone" (?leave=1)
 * only unlinks the phone (leave_family_phone).
 */
export default function DeleteMeScreen() {
  const { leave } = useLocalSearchParams<{ leave?: string }>();
  const leaving = leave === '1';
  const { current, signOut } = useFamily();
  const toast = useToast();
  const goBack = useGoBack();
  const { top } = useInsets();
  const { t } = useT();
  const name = current?.display_name ?? '';
  return (
    <View style={styles.root}>
      <View style={[styles.head, { paddingTop: top + space.sm }]}>
        <PageHeader back title={leaving ? t('me.signOutPhone') : t('me.deleteMe')} />
      </View>
      <View style={styles.pinWrap}>
        <PinPad
          title={leaving ? t('me.signOutPhonePin') : t('me.deleteMePin')}
          onCancel={() => goBack()}
          onComplete={async (pin) => {
            const { data, error } = leaving ? await supabase.rpc('leave_family_phone', { p_pin: pin }) : await supabase.rpc('delete_my_profile', { p_pin: pin });
            if (error) return error.message;
            if (!data) return false;
            if (!leaving) toast({ text: t('me.deletedMe', { name }), icon: 'check' });
            await signOut();
            return true;
          }}
        />
        <Text style={styles.note}>{leaving ? t('me.signOutPhoneBody') : t('me.deleteMeBody', { name })}</Text>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  head: { paddingHorizontal: layout.gutter },
  pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: layout.gutter, paddingBottom: space.xxxl },
  note: { color: color.text3, fontFamily: font.medium, ...type.small, textAlign: 'center' },
}));
