import { useCallback, useEffect, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { MediaSource, mediaFor, signMedia } from '@/features/feed/data';
import { supabase } from '@/lib/supabase';
import { lane as lanes } from '@/theme/tokens';

type Recent = { id: string; storage_path: string | null; thumb_path: string | null; asset_key: string | null };
type Row = { creator_name: string; verified: boolean; video_count: number; follower_count: number; following: boolean; topics: string[]; recent: Recent[] };

export type ChannelHub = {
  name: string;
  verified: boolean;
  count: number;
  followers: number;
  following: boolean;
  topics: string[];
  /** Up to three newest posters, for the hub card. */
  posters: { id: string; thumb: MediaSource }[];
  look: ChannelLook;
};

export type ChannelLook = { sticker: string; tint: string };

/** Our own channels get a fixed sticker and colour; others take their main topic's sticker. */
const LOOKS: Record<string, ChannelLook> = {
  'Payhas Nature': { sticker: 'nature', tint: lanes.kids.color },
  'Payhas Wild': { sticker: 'animals', tint: lanes.little.color },
  'Payhas Space': { sticker: 'space', tint: lanes.teen.color },
  'Payhas Pets': { sticker: 'animals', tint: lanes.adult.color },
  'Payhas Science': { sticker: 'science', tint: lanes.teen.color },
  'Payhas Studio': { sticker: 'drawing', tint: lanes.little.color },
  'Payhas World': { sticker: 'play', tint: lanes.kids.color },
  'Payhas Kitchen': { sticker: 'cooking', tint: lanes.kids.color },
  'Payhas Music': { sticker: 'music', tint: lanes.adult.color },
};
const ROTATION = [lanes.kids.color, lanes.teen.color, lanes.little.color, lanes.adult.color];

export function channelLook(name: string, topics: string[] = []): ChannelLook {
  if (LOOKS[name]) return LOOKS[name];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { sticker: topics[0] ?? 'play', tint: ROTATION[h % ROTATION.length] };
}

/**
 * Every channel this profile may watch, busiest first, from get_channels():
 * counts are lane-gated on the server, posters are the three newest videos.
 */
export function useChannels() {
  const { active } = useFamily();
  const [channels, setChannels] = useState<ChannelHub[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!active) return;
    // get_channels arrives with migration 20261029090000; the generated types don't know it yet.
    const { data } = await (supabase.rpc as unknown as (fn: string, args: object) => Promise<{ data: Row[] | null }>)('get_channels', { p_session: active.token });
    const rows = data ?? [];
    const urls = await signMedia(rows.flatMap((r) => r.recent));
    setChannels(
      rows.map((r) => ({
        name: r.creator_name,
        verified: r.verified,
        count: r.video_count,
        followers: r.follower_count,
        following: r.following,
        topics: r.topics ?? [],
        posters: r.recent.flatMap((v) => {
          const m = mediaFor(v, urls);
          return m ? [{ id: v.id, thumb: m.thumb }] : [];
        }),
        look: channelLook(r.creator_name, r.topics ?? []),
      })),
    );
    setLoading(false);
  }, [active]);

  useEffect(() => {
    load();
  }, [load]);

  return { channels, loading, reload: load };
}
