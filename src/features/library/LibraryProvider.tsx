import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type GameId = 'bubbles' | 'memory';
export type InboxItem = Database['public']['Functions']['get_inbox']['Returns'][number];

type Library = {
  saved: Set<string>;
  following: Set<string>;
  toggleSave: (videoId: string) => void;
  toggleFollow: (creator: string) => void;
  /** Records watch time for the active profile and counts it toward today. */
  logWatch: (videoId: string, seconds: number) => void;
  /** Same, for time spent in a Play game. */
  logPlay: (game: GameId, seconds: number) => void;
  todaySeconds: number;
  /** Bumped after any change, so screens showing derived numbers can refetch. */
  version: number;
  inbox: InboxItem[];
  unread: number;
  refreshInbox: () => Promise<void>;
  markInboxRead: () => void;
};

const Ctx = createContext<Library | null>(null);
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

/** Saves, follows and today's watch time for the active profile. */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const { active } = useFamily();
  const token = active?.token;
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [version, setVersion] = useState(0);
  const [inbox, setInbox] = useState<InboxItem[]>([]);

  const refreshInbox = useCallback(async () => {
    if (!token) return;
    const { data } = await supabase.rpc('get_inbox', { p_session: token });
    setInbox(data ?? []);
  }, [token]);

  // Mark read on the server, but keep the local dots until the next refresh so
  // the screen that triggered it can still show what was new.
  const markInboxRead = useCallback(() => {
    if (token) supabase.rpc('mark_inbox_read', { p_session: token }).then(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    supabase.rpc('get_library', { p_session: token }).then(({ data }) => {
      const lib = (data ?? {}) as { saved?: string[]; following?: string[] };
      setSaved(new Set(lib.saved ?? []));
      setFollowing(new Set(lib.following ?? []));
    });
    supabase.rpc('get_me', { p_session: token, p_tz: deviceTimeZone() }).then(({ data }) => {
      setTodaySeconds(((data ?? {}) as { today_seconds?: number }).today_seconds ?? 0);
    });
    refreshInbox();
  }, [token, refreshInbox]);

  // Optimistic: flip locally, then let the server have the final word.
  const toggleIn = (setter: typeof setSaved, key: string, on?: boolean) =>
    setter((cur) => {
      const next = new Set(cur);
      if (on ?? !next.has(key)) next.add(key);
      else next.delete(key);
      return next;
    });

  const toggleSave = useCallback(
    (videoId: string) => {
      if (!token) return;
      toggleIn(setSaved, videoId);
      supabase.rpc('toggle_save', { p_session: token, p_video_id: videoId }).then(({ data, error }) => {
        if (!error) toggleIn(setSaved, videoId, !!data);
        setVersion((v) => v + 1);
      });
    },
    [token],
  );

  const toggleFollow = useCallback(
    (creator: string) => {
      if (!token) return;
      toggleIn(setFollowing, creator);
      supabase.rpc('toggle_follow', { p_session: token, p_creator: creator }).then(({ data, error }) => {
        if (!error) toggleIn(setFollowing, creator, !!data);
        setVersion((v) => v + 1);
      });
    },
    [token],
  );

  const logWatch = useCallback(
    (videoId: string, seconds: number) => {
      const s = Math.round(seconds);
      if (!token || s < 1) return;
      setTodaySeconds((t) => t + s);
      supabase.rpc('log_watch', { p_session: token, p_video_id: videoId, p_seconds: s }).then(() => setVersion((v) => v + 1));
    },
    [token],
  );

  const logPlay = useCallback(
    (game: GameId, seconds: number) => {
      const s = Math.round(seconds);
      if (!token || s < 1) return;
      setTodaySeconds((t) => t + s);
      supabase.rpc('log_play', { p_session: token, p_game: game, p_seconds: s }).then(() => setVersion((v) => v + 1));
    },
    [token],
  );

  const unread = inbox.filter((i) => !i.read_at).length;

  const value = useMemo(
    () => ({ saved, following, toggleSave, toggleFollow, logWatch, logPlay, todaySeconds, version, inbox, unread, refreshInbox, markInboxRead }),
    [saved, following, toggleSave, toggleFollow, logWatch, logPlay, todaySeconds, version, inbox, unread, refreshInbox, markInboxRead],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return ctx;
}
