import { useCallback } from 'react';

import { firstRun } from '@/features/start/firstRun';
import { useT } from '@/i18n';

/**
 * Back from sign-in (or a join that started on Welcome) to the language step.
 * The router only shows Welcome and the language while none is chosen, so this
 * un-chooses it; Welcome then opens the language step on top of itself.
 */
export function useBackToLanguage() {
  const { unchoose } = useT();
  return useCallback(() => {
    firstRun.reopenLanguage = true;
    unchoose();
  }, [unchoose]);
}
