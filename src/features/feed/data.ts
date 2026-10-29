import { Lang, localized } from '@/i18n';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { Lane } from '@/theme/tokens';

export type VideoRow = Database['public']['Functions']['get_feed']['Returns'][number];
export type MediaSource = number | { uri: string };

export type FeedVideo = {
  id: string;
  source: MediaSource; // bundled asset (seed clips) or a signed storage URL (uploads)
  thumb: MediaSource;
  creator: { name: string; verified: boolean };
  caption: string;
  lane: Lane; // youngest lane the video is rated for
  topics: string[];
  views: number;
  likes: number;
  saves: number;
  shares: number;
  reactions: Record<string, number>;
  /** Licence credit for imported footage, e.g. "Video: Jane Doe · Pixabay". */
  credit: string | null;
  /** Where imported footage came from and under what licence; null for Payhas' own videos. */
  origin: { name: string; license: string | null } | null;
};

/** Display names for import sources; uploads, seeds and originals are Payhas' own. */
const SOURCE_NAMES: Record<string, string> = { pixabay: 'Pixabay', nasa: 'NASA', wikimedia: 'Wikimedia Commons' };

/** Bundled media for the seed clips, keyed by videos.asset_key. */
const LOCAL_MEDIA: Record<string, { source: number; thumb: number }> = {
  'eyes-rhyme': {
    source: require('../../../assets/videos/eyes-rhyme.mp4'),
    thumb: require('../../../assets/thumbs/eyes-rhyme.jpg'),
  },
  playground: {
    source: require('../../../assets/videos/playground.mp4'),
    thumb: require('../../../assets/thumbs/playground.jpg'),
  },
  bunny: {
    source: require('../../../assets/videos/bunny.mp4'),
    thumb: require('../../../assets/thumbs/bunny.jpg'),
  },
};

/** Signed links live an hour; a feed session is far shorter, and every fetch re-signs. */
const SIGNED_FOR_S = 60 * 60;

/**
 * The public Cloudflare R2 bucket (`payhas-media`) that holds curated imports.
 * Set EXPO_PUBLIC_MEDIA_URL to its custom domain; r2.dev is rate-limited and
 * only the fallback.
 */
const R2_PUBLIC = (process.env.EXPO_PUBLIC_MEDIA_URL || 'https://pub-592e6ab7d542491f89e627a41d432993.r2.dev').replace(/\/+$/, '');
const R2_PREFIX = 'r2:';

/**
 * Signed URLs for any uploaded files among these rows, in one request.
 * Storage policies decide what can be signed: published files for everyone,
 * pending ones only for their creator and moderators.
 */
export async function signMedia(rows: { storage_path?: string | null; thumb_path?: string | null }[]): Promise<Record<string, string>> {
  const paths = rows.flatMap((r) => [r.storage_path, r.thumb_path]).filter((p): p is string => !!p);
  // Curated imports live in the public R2 bucket (`r2:<key>`) and need no signing.
  const out: Record<string, string> = Object.fromEntries(paths.filter((p) => p.startsWith(R2_PREFIX)).map((p) => [p, `${R2_PUBLIC}/${p.slice(R2_PREFIX.length)}`]));
  const signed = paths.filter((p) => !p.startsWith(R2_PREFIX));
  if (signed.length === 0) return out;
  const { data } = await supabase.storage.from('videos').createSignedUrls(signed, SIGNED_FOR_S);
  for (const d of data ?? []) if (d.signedUrl && d.path) out[d.path] = d.signedUrl;
  return out;
}

export function mediaFor(row: { asset_key?: string | null; storage_path?: string | null; thumb_path?: string | null }, urls: Record<string, string>) {
  if (row.asset_key && LOCAL_MEDIA[row.asset_key]) return LOCAL_MEDIA[row.asset_key];
  const src = row.storage_path ? urls[row.storage_path] : undefined;
  const th = row.thumb_path ? urls[row.thumb_path] : undefined;
  return src ? { source: { uri: src }, thumb: th ? { uri: th } : { uri: src } } : null;
}

/** Server row → what the UI plays. Rows whose media can't be resolved are skipped (null). */
export function toFeedVideo(row: VideoRow, urls: Record<string, string> = {}, lang: Lang = 'en'): FeedVideo | null {
  const media = mediaFor(row, urls);
  if (!media) return null;
  return {
    id: row.id,
    ...media,
    creator: { name: row.creator_name, verified: row.creator_verified },
    caption: localized(lang, row.caption, row.caption_i18n),
    lane: row.lane,
    topics: row.topics,
    views: row.view_count,
    likes: row.like_count,
    saves: row.save_count,
    shares: row.share_count,
    reactions: (row.reaction_counts ?? {}) as Record<string, number>,
    credit: row.attribution ?? null,
    origin: SOURCE_NAMES[row.source] ? { name: SOURCE_NAMES[row.source], license: row.license ?? null } : null,
  };
}

/** Rows → playable videos, signing uploaded files first; captions in the app's language. */
export async function toFeedVideos(rows: VideoRow[] | null, lang: Lang = 'en'): Promise<FeedVideo[]> {
  const list = rows ?? [];
  const urls = await signMedia(list);
  return list.flatMap((r) => toFeedVideo(r, urls, lang) ?? []);
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}
