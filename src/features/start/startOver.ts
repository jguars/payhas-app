import { useCallback } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { useT } from '@/i18n';

/**
 * Testing only (shown while Plus test mode is on): back to the very first
 * screen, as if the app was just installed — signed out, this phone's saved
 * choices cleared (language, open profile, a waiting join request, theme), so
 * Welcome comes next. The family and its data on the server stay as they are.
 */
export function useStartOver() {
  const { signOut } = useFamily();
  const { unchoose } = useT();
  return useCallback(async () => {
    await signOut();
    try {
      localStorage.clear();
    } catch {}
    unchoose();
  }, [signOut, unchoose]);
}
