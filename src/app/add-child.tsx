import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useFamily } from '@/features/family/FamilyProvider';
import { ChildSetup } from '@/features/onboarding/ChildSetup';
import { ConsentStep, useParentalConsent } from '@/features/onboarding/Consent';
import { ParentSessionProvider, useParentSession } from '@/features/onboarding/ParentSession';
import { useGoBack } from '@/lib/useGoBack';
import { pageFill } from '@/theme/tokens';

/** "Add" on Who's watching: the parent PIN, the parental notice if not yet agreed, then the same child setup as onboarding. */
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
      onCancel={goBack}
      onDone={async () => {
        await refresh();
        goBack();
      }}
    />
  );
}
