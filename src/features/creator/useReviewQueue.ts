import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { signMedia, VideoRow } from '@/features/feed/data';
import type { T, TKey } from '@/i18n';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

/**
 * Human review is switched off for now (private.settings.review_required =
 * false): uploads and imports publish straight away, gated only by age lane.
 * Flip both this and the database setting to bring the Review queue back.
 */
export const REVIEW_ENABLED = false;

export type ReportRow = Database['public']['Functions']['get_report_queue']['Returns'][number];

/** Pending uploads and reported videos, with signed media, refreshed whenever the screen is focused. */
export function useReviewQueue() {
  const [uploads, setUploads] = useState<VideoRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [u, r] = await Promise.all([supabase.rpc('get_review_queue'), supabase.rpc('get_report_queue')]);
    const up = u.data ?? [];
    const rep = r.data ?? [];
    setUrls(await signMedia([...up, ...rep]));
    setUploads(up);
    setReports(rep);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { uploads, reports, urls, loaded, reload: load };
}

/**
 * Why a video was rejected or taken down. `text` (English) is what gets sent and
 * stored, so it stays stable; the key is only for showing it in the app's language.
 */
export const REJECT_REASONS: { text: string; key: TKey }[] = [
  { text: 'Not right for children', key: 'creator.reject.children' },
  { text: 'Doesn’t fit any lane clearly', key: 'creator.reject.lane' },
  { text: 'Shows personal details or someone without permission', key: 'creator.reject.personal' },
  { text: 'Copyright — not the creator’s own content', key: 'creator.reject.copyright' },
  { text: 'Poor quality', key: 'creator.reject.quality' },
];

/** A stored rejection reason in the current language (free text stays as it was written). */
export function rejectReasonLabel(t: T, stored: string) {
  const r = REJECT_REASONS.find((x) => x.text === stored);
  return r ? t(r.key) : stored;
}

const REASON_KEY: Record<string, TKey> = {
  scary: 'creator.reason.scary',
  not_my_age: 'creator.reason.not_my_age',
  mean: 'creator.reason.mean',
  other: 'creator.reason.other',
};

/** A viewer's report reason ("scary", "not_my_age", …) as a label. */
export function reasonLabel(t: T, reason: string) {
  const k = REASON_KEY[reason];
  return k ? t(k) : reason;
}
