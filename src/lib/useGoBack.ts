import { router } from 'expo-router';
import { useCallback } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';

/**
 * Back that always lands somewhere. Picking or leaving a profile swaps the
 * whole stack (Stack.Protected), and a cold start or deep link opens a screen
 * with nothing under it — plain router.back() then does nothing. Fall back to
 * the feed inside a profile (or its interest picker on first open), or
 * "Who's watching?" outside one.
 */
export function useGoBack() {
  const { active, needsInterests } = useFamily();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(!active ? '/who' : needsInterests ? '/interests' : '/');
  }, [active, needsInterests]);
}
