import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, View } from 'react-native';

import { PinPad } from '@/components/PinPad';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { pageFill, themedStyles } from '@/theme/tokens';

/** The server's parent session lasts 15 minutes; renew a little early. */
const LIFETIME_MS = 14 * 60_000;

type Ctx = {
  /** A live parent-session token, asking for the PIN first when there isn't one. Null if cancelled. */
  ensure: () => Promise<string | null>;
  /** Use a token just obtained elsewhere (e.g. right after the PIN is created). */
  adopt: (token: string) => void;
  /** The server said the session expired: forget it so the next ensure() asks again. */
  invalidate: () => void;
};

const ParentCtx = createContext<Ctx | null>(null);

/**
 * Wraps a multi-step parent flow (onboarding, adding a child) so one PIN
 * covers it, and a PIN pad pops up again only if the session runs out.
 */
export function ParentSessionProvider({ children }: { children: ReactNode }) {
  const { t } = useT();
  const session = useRef<{ token: string; until: number } | null>(null);
  const [asking, setAsking] = useState<((token: string | null) => void) | null>(null);

  const adopt = useCallback((token: string) => {
    session.current = { token, until: Date.now() + LIFETIME_MS };
  }, []);
  const invalidate = useCallback(() => {
    session.current = null;
  }, []);
  const ensure = useCallback(
    () =>
      session.current && session.current.until > Date.now()
        ? Promise.resolve(session.current.token)
        : new Promise<string | null>((resolve) => setAsking(() => resolve)),
    [],
  );

  const value = useMemo(() => ({ ensure, adopt, invalidate }), [ensure, adopt, invalidate]);

  return (
    <ParentCtx.Provider value={value}>
      {children}
      <Modal visible={!!asking} animationType="fade" transparent onRequestClose={() => finish(null)}>
        <View style={styles.backdrop}>
          <PinPad
            title={t('onboarding.pin.enter')}
            onCancel={() => finish(null)}
            onComplete={async (pin) => {
              const { data, error } = await supabase.rpc('start_parent_session', { p_pin: pin });
              if (error) return error.message;
              if (!data) return false;
              adopt(data);
              finish(data);
              return true;
            }}
          />
        </View>
      </Modal>
    </ParentCtx.Provider>
  );

  function finish(token: string | null) {
    asking?.(token);
    setAsking(null);
  }
}

export function useParentSession() {
  const ctx = useContext(ParentCtx);
  if (!ctx) throw new Error('useParentSession must be used inside <ParentSessionProvider>');
  return ctx;
}

/** Runs an RPC that needs the parent token, renewing the session once if the server says it expired. */
export async function withParent<R extends { error: { code?: string } | null }>(
  gate: Ctx,
  call: (token: string) => PromiseLike<R>,
): Promise<R | null> {
  let token = await gate.ensure();
  if (!token) return null;
  let res = await call(token);
  if (res.error?.code === '42501') {
    gate.invalidate();
    token = await gate.ensure();
    if (!token) return null;
    res = await call(token);
  }
  return res;
}

const styles = themedStyles(() => ({
  backdrop: { flex: 1, ...pageFill(), alignItems: 'center', justifyContent: 'center' },
}));
