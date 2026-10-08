import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type GameId = 'bubbles' | 'memory';
export type InboxItem = Database['public']['Functions']['get_inbox']['Returns'][number];
export type Signal = 'impression' | 'finish' | 'rewatch' | 'quick_skip';
export type ReportReason = 'scary' | 'not_my_age' | 'mean' | 'other';

/** The fixed reaction set — the database rejects anything else. */
export const REACTIONS = ['😂', '❤️', '😮', '👏', '🤩', '😢'] as const;

type Library = {
  saved: Set<string>;
  following: Set<string>;
  liked: Set<string>;
  /** video id → emoji this profile has reacted with */
  reacted: Map<string, Set<string>>;
  /** Videos hidden this session (not interested / reported); feeds drop them at once. */
  hidden: Set<string>;
  /** Local count adjustments since load, so counters move the moment you tap. */
  likeDelta: (videoId: string) => number;
  saveDelta: (videoId: string) => number;
  reactionDelta: (videoId: string, emoji: string) => number;
  toggleSave: (videoId: string) => void;
  toggleFollow: (creator: string) => void;
  toggleLike: (videoId: string) => void;
  /** Double-tap: like if not liked yet, never unlike. */
  likeOnce: (videoId: string) => void;
  toggleReaction: (videoId: string, emoji: string) => void;
  hide: (videoId: string) => void;
  report: (videoId: string, reason: ReportReason) => void;
  sendToFamily: (videoId: string, toProfileId: string) => Promise<boolean>;
  logExternalShare: (videoId: string) => void;
  signal: (videoId: string, kind: Signal) => void;
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

const flip = (set: Set<string>, key: string, on?: boolean) => {
  const next = new Set(set);
  if (on ?? !next.has(key)) next.add(key);
  else next.delete(key);
  return next;
};

/** Everything the active profile has done to videos and creators, kept in sync with the server. */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const { active } = useFamily();
  const token = active?.token;
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [savedAtLoad, setSavedAtLoad] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [likedAtLoad, setLikedAtLoad] = useState<Set<string>>(new Set());
  const [reacted, setReacted] = useState<Map<string, Set<string>>>(new Map());
  const [reactedAtLoad, setReactedAtLoad] = useState<Map<string, Set<string>>>(new Map());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [version, setVersion] = useState(0);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

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
    setHidden(new Set());
    supabase.rpc('get_library', { p_session: token }).then(({ data }) => {
      const lib = (data ?? {}) as {
        saved?: string[];
        following?: string[];
        liked?: string[];
        reactions?: { video_id: string; emoji: string }[];
      };
      const sv = new Set(lib.saved ?? []);
      setSaved(sv);
      setSavedAtLoad(sv);
      setFollowing(new Set(lib.following ?? []));
      const l = new Set(lib.liked ?? []);
      setLiked(l);
      setLikedAtLoad(l);
      const r = new Map<string, Set<string>>();
      for (const { video_id, emoji } of lib.reactions ?? []) r.set(video_id, new Set([...(r.get(video_id) ?? []), emoji]));
      setReacted(r);
      setReactedAtLoad(r);
    });
    supabase.rpc('get_me', { p_session: token, p_tz: deviceTimeZone() }).then(({ data }) => {
      setTodaySeconds(((data ?? {}) as { today_seconds?: number }).today_seconds ?? 0);
    });
    refreshInbox();
  }, [token, refreshInbox]);

  // Optimistic: flip locally, then let the server have the final word.
  const toggleSave = useCallback(
    (videoId: string) => {
      if (!token) return;
      setSaved((s) => flip(s, videoId));
      supabase.rpc('toggle_save', { p_session: token, p_video_id: videoId }).then(({ data, error }) => {
        if (!error) setSaved((s) => flip(s, videoId, !!data));
        bump();
      });
    },
    [token, bump],
  );

  const toggleFollow = useCallback(
    (creator: string) => {
      if (!token) return;
      setFollowing((s) => flip(s, creator));
      supabase.rpc('toggle_follow', { p_session: token, p_creator: creator }).then(({ data, error }) => {
        if (!error) setFollowing((s) => flip(s, creator, !!data));
        bump();
      });
    },
    [token, bump],
  );

  const toggleLike = useCallback(
    (videoId: string) => {
      if (!token) return;
      setLiked((s) => flip(s, videoId));
      supabase.rpc('toggle_like', { p_session: token, p_video_id: videoId }).then(({ data, error }) => {
        if (!error) setLiked((s) => flip(s, videoId, !!data));
      });
    },
    [token],
  );

  const likeOnce = useCallback(
    (videoId: string) => {
      if (!token) return;
      setLiked((s) => flip(s, videoId, true));
      supabase.rpc('set_like', { p_session: token, p_video_id: videoId }).then(() => {});
    },
    [token],
  );

  const toggleReaction = useCallback(
    (videoId: string, emoji: string) => {
      if (!token) return;
      const apply = (on?: boolean) =>
        setReacted((m) => {
          const next = new Map(m);
          next.set(videoId, flip(m.get(videoId) ?? new Set(), emoji, on));
          return next;
        });
      apply();
      supabase.rpc('toggle_reaction', { p_session: token, p_video_id: videoId, p_emoji: emoji }).then(({ data, error }) => {
        if (!error) apply(!!data);
      });
    },
    [token],
  );

  const hide = useCallback(
    (videoId: string) => {
      if (!token) return;
      setHidden((s) => flip(s, videoId, true));
      supabase.rpc('hide_video', { p_session: token, p_video_id: videoId }).then(bump);
    },
    [token, bump],
  );

  const report = useCallback(
    (videoId: string, reason: ReportReason) => {
      if (!token) return;
      setHidden((s) => flip(s, videoId, true));
      supabase.rpc('report_video', { p_session: token, p_video_id: videoId, p_reason: reason }).then(bump);
    },
    [token, bump],
  );

  const sendToFamily = useCallback(
    async (videoId: string, toProfileId: string) => {
      if (!token) return false;
      const { data, error } = await supabase.rpc('send_to_family', { p_session: token, p_video_id: videoId, p_to_profile_id: toProfileId });
      return !error && !!data;
    },
    [token],
  );

  const logExternalShare = useCallback(
    (videoId: string) => {
      if (token) supabase.rpc('log_external_share', { p_session: token, p_video_id: videoId }).then(() => {});
    },
    [token],
  );

  const signal = useCallback(
    (videoId: string, kind: Signal) => {
      if (token) supabase.rpc('log_event', { p_session: token, p_video_id: videoId, p_kind: kind }).then(() => {});
    },
    [token],
  );

  const logWatch = useCallback(
    (videoId: string, seconds: number) => {
      const s = Math.round(seconds);
      if (!token || s < 1) return;
      setTodaySeconds((t) => t + s);
      supabase.rpc('log_watch', { p_session: token, p_video_id: videoId, p_seconds: s }).then(bump);
    },
    [token, bump],
  );

  const logPlay = useCallback(
    (game: GameId, seconds: number) => {
      const s = Math.round(seconds);
      if (!token || s < 1) return;
      setTodaySeconds((t) => t + s);
      supabase.rpc('log_play', { p_session: token, p_game: game, p_seconds: s }).then(bump);
    },
    [token, bump],
  );

  const likeDelta = useCallback((id: string) => Number(liked.has(id)) - Number(likedAtLoad.has(id)), [liked, likedAtLoad]);
  const saveDelta = useCallback((id: string) => Number(saved.has(id)) - Number(savedAtLoad.has(id)), [saved, savedAtLoad]);
  const reactionDelta = useCallback(
    (id: string, emoji: string) => Number(!!reacted.get(id)?.has(emoji)) - Number(!!reactedAtLoad.get(id)?.has(emoji)),
    [reacted, reactedAtLoad],
  );

  const unread = inbox.filter((i) => !i.read_at).length;

  const value = useMemo(
    () => ({
      saved,
      following,
      liked,
      reacted,
      hidden,
      likeDelta,
      saveDelta,
      reactionDelta,
      toggleSave,
      toggleFollow,
      toggleLike,
      likeOnce,
      toggleReaction,
      hide,
      report,
      sendToFamily,
      logExternalShare,
      signal,
      logWatch,
      logPlay,
      todaySeconds,
      version,
      inbox,
      unread,
      refreshInbox,
      markInboxRead,
    }),
    [
      saved, following, liked, reacted, hidden, likeDelta, saveDelta, reactionDelta, toggleSave, toggleFollow, toggleLike, likeOnce,
      toggleReaction, hide, report, sendToFamily, logExternalShare, signal, logWatch, logPlay, todaySeconds, version, inbox,
      unread, refreshInbox, markInboxRead,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return ctx;
}
