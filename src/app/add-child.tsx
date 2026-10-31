import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useToast } from '@/components/Toast';

import { useFamily } from '@/features/family/FamilyProvider';
import { ChildSetup } from '@/features/onboarding/ChildSetup';
import { ConsentStep, useParentalConsent } from '@/features/onboarding/Consent';
import { ParentSessionProvider, useParentSession } from '@/features/onboarding/ParentSession';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useGoBack } from '@/lib/useGoBack';
import { pageFill } from '@/theme/tokens';

/**
 * "Add" on Who's watching: the parent PIN, the parental notice if not yet
 * agreed, then the same child setup as onboarding. Opened from a phone's join
 * request (`request`), the new child then gets that phone.
 */
export default function AddChildScreen() {
  return (
    <ParentSessionProvider>
      <AddChild />
    </ParentSessionProvider>
  );
}

function AddChild() {
  const gate = useParentSession();
  const { refresh } = useFamily();
  const goBack = useGoBack();
  const consent = useParentalConsent();
  const { request } = useLocalSearchParams<{ request?: string }>();
  const toast = useToast();
  const { t } = useT();
  const [unlocked, setUnlocked] = useState(false);

  // Ask for the PIN up front, so a child never gets halfway through a form they can't save.
  useEffect(() => {
    gate.ensure().then((token) => (token ? setUnlocked(true) : goBack()));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!unlocked || consent.given === null) return <View style={{ flex: 1, ...pageFill() }} />;
  if (!consent.given) return <ConsentStep progress={0} onBack={goBack} onAgreed={() => consent.setGiven(true)} />;
  return (
    <ChildSetup
      progress={[0, 1]}
      quick={!!request}
      onCancel={goBack}
      onDone={async (child) => {
        if (request) {
          const token = await gate.ensure();
          const { data } = token ? await supabase.rpc('assign_join_request', { p_parent: token, p_request: request, p_profile: child.id }) : { data: null };
          toast(data === 'ok' ? { text: t('ask.linkedNote', { name: child.name }), icon: 'check' } : { text: t('ask.gone'), icon: 'close' });
        }
        await refresh();
        goBack();
      }}
    />
  );
}
