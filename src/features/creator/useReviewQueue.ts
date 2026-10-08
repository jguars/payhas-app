import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { signMedia, VideoRow } from '@/features/feed/data';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

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

export const REJECT_REASONS = [
  'Not right for children',
  'Doesn’t fit any lane clearly',
  'Shows personal details or someone without permission',
  'Copyright — not the creator’s own content',
  'Poor quality',
];

export const REASON_LABEL: Record<string, string> = { scary: 'Scary', not_my_age: 'Wrong age', mean: 'Mean', other: 'Other' };
