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
 * "Delete my account" on a child's own phone. A parent confirms with the
 * family PIN; then the child's profile and everything in it are deleted and
 * this phone leaves the family (delete_my_profile).
 */
export default function DeleteMeScreen() {
  const { current, signOut } = useFamily();
  const toast = useToast();
  const goBack = useGoBack();
  const { top } = useInsets();
  const { t } = useT();
  const name = current?.display_name ?? '';
  return (
    <View style={styles.root}>
      <View style={[styles.head, { paddingTop: top + space.sm }]}>
        <PageHeader back title={t('me.deleteMe')} />
      </View>
      <View style={styles.pinWrap}>
        <PinPad
          title={t('me.deleteMePin')}
          onCancel={() => goBack()}
          onComplete={async (pin) => {
            const { data, error } = await supabase.rpc('delete_my_profile', { p_pin: pin });
            if (error) return error.message;
            if (!data) return false;
            toast({ text: t('me.deletedMe', { name }), icon: 'check' });
            await signOut();
            return true;
          }}
        />
        <Text style={styles.note}>{t('me.deleteMeBody', { name })}</Text>
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
