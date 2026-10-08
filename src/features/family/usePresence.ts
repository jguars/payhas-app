import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

import { useFamily } from './FamilyProvider';

const EVERY_MS = 60_000;

/** What the dashboard shows next to a child: watching, playing, or browsing. */
function activityFor(path: string) {
  if (path === '/') return 'watching';
  if (path === '/play' || path.startsWith('/games')) return 'playing';
  return 'browsing';
}

/**
 * Tells the parent dashboard this profile is in the app right now. Pings on
 * open, on every screen change and once a minute while the app is in front.
 */
export function usePresence() {
  const { active } = useFamily();
  const path = usePathname();
  const token = active?.token;
  const activity = useRef(activityFor(path));
  activity.current = activityFor(path);

  useEffect(() => {
    if (!token) return;
    const ping = () => {
      if (AppState.currentState === 'active') supabase.rpc('ping_session', { p_session: token, p_activity: activity.current }).then(() => {});
    };
    ping();
    const id = setInterval(ping, EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && ping());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [token, path]);
}
