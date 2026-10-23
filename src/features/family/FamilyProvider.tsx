import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Profile = Tables<'profiles'> & { interestCount: number };
export type ActiveProfile = { profile: Profile; token: string };
export type Family = Pick<Tables<'families'>, 'id' | 'language' | 'onboarded_at'>;

type FamilyContext = {
  ready: boolean;
  session: Session | null;
  profiles: Profile[];
  family: Family | null;
  /** Signed in, but the family hasn't been through onboarding yet. */
  needsOnboarding: boolean;
  hasPin: boolean;
  active: ActiveProfile | null;
  /** The active profile's latest row (active.profile is the copy taken when it was opened). */
  current: Profile | null;
  /** The active profile hasn't picked any interests yet (cold start). */
  needsInterests: boolean;
  refresh: () => Promise<void>;
  /** Opens a profile session. Resolves false on a wrong PIN; throws on lockout. */
  selectProfile: (profile: Profile, pin?: string) => Promise<boolean>;
  leaveProfile: () => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<FamilyContext | null>(null);
const ACTIVE_KEY = 'payhas.activeProfile';

function readStoredActive(): { profileId: string; token: string } | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeActive(value: ActiveProfile | null) {
  if (value) localStorage.setItem(ACTIVE_KEY, JSON.stringify({ profileId: value.profile.id, token: value.token }));
  else localStorage.removeItem(ACTIVE_KEY);
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hasPin, setHasPin] = useState(false);
  const [family, setFamily] = useState<Family | null>(null);
  const [active, setActive] = useState<ActiveProfile | null>(null);

  const refresh = useCallback(async () => {
    const [{ data: rows }, { data: pinSet }, { data: fam }] = await Promise.all([
      supabase.from('profiles').select('*, profile_interests(count)').order('created_at'),
      supabase.rpc('has_parent_pin'),
      supabase.from('families').select('id, language, onboarded_at').maybeSingle(),
    ]);
    setFamily(fam ?? null);
    const list = (rows ?? []).map(({ profile_interests, ...p }) => ({ ...p, interestCount: profile_interests[0]?.count ?? 0 }));
    setProfiles(list);
    setHasPin(!!pinSet);
    // Restore the last profile if it still exists; the server rejects stale tokens.
    const stored = readStoredActive();
    const profile = stored && list.find((p) => p.id === stored.profileId);
    setActive((cur) => cur ?? (profile && stored ? { profile, token: stored.token } : null));
  }, []);

  // Supabase calls must not run inside onAuthStateChange, so the callback only
  // records the user; the effect below loads that user's family.
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthChecked(true);
      if (!next) {
        setProfiles([]);
        setFamily(null);
        setActive(null);
        storeActive(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!authChecked) return;
    if (!userId) return setReady(true);
    setReady(false);
    refresh().finally(() => setReady(true));
  }, [authChecked, userId, refresh]);

  // Parent remote control: any change to a family profile (pause, limits,
  // bedtime, extra time) made on another device lands here within a second.
  // RLS on profiles lets the realtime server send only this family's rows.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`family:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        refresh();
      })
      .subscribe();
    // Catch anything missed while the app was in the background.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      supabase.removeChannel(channel);
      sub.remove();
    };
  }, [userId, refresh]);

  const selectProfile = useCallback(async (profile: Profile, pin?: string) => {
    const { data: token, error } = await supabase.rpc('start_profile_session', { p_profile_id: profile.id, p_pin: pin });
    if (error) throw new Error(error.message);
    if (!token) return false;
    const next = { profile, token };
    storeActive(next);
    setActive(next);
    return true;
  }, []);

  const leaveProfile = useCallback(() => {
    storeActive(null);
    setActive(null);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const current = (active && profiles.find((p) => p.id === active.profile.id)) ?? active?.profile ?? null;
  const needsInterests = !!current && current.interestCount === 0;
  const needsOnboarding = !!session && !!family && !family.onboarded_at;

  const value = useMemo(
    () => ({ ready, session, profiles, family, needsOnboarding, hasPin, active, current, needsInterests, refresh, selectProfile, leaveProfile, signOut }),
    [ready, session, profiles, family, needsOnboarding, hasPin, active, current, needsInterests, refresh, selectProfile, leaveProfile, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFamily() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFamily must be used inside <FamilyProvider>');
  return ctx;
}
