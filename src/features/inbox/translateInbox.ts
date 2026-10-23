import { localized, topicLabel, type Lang, type T, type TKey } from '@/i18n';
import type { InboxItem } from '@/features/library/LibraryProvider';
import { hourLabel } from '@/features/library/useScreenTime';

/** English interest labels as the server writes them → topic slugs. */
const TOPIC_SLUGS: Record<string, string> = {
  Animals: 'animals',
  Rhymes: 'rhymes',
  Stories: 'stories',
  Play: 'play',
  Puppets: 'puppets',
  Learning: 'learning',
  Nature: 'nature',
  Space: 'space',
  Drawing: 'drawing',
  Science: 'science',
  Sports: 'sports',
  Building: 'building',
  Gaming: 'gaming',
  Music: 'music',
  Fashion: 'fashion',
  Comedy: 'comedy',
  Cooking: 'cooking',
  News: 'news',
};

/** "7pm" / "12am" (Postgres FMHH12am) → hour 0–23, or null. */
function parseHour(s: string): number | null {
  const m = /^(\d{1,2})\s*(am|pm)$/i.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]) % 12;
  return m[2].toLowerCase() === 'pm' ? h + 12 : h;
}

const hour = (s: string, lang: Lang) => {
  const h = parseHour(s);
  return h == null ? s : hourLabel(h, lang);
};

/** Fixed English texts → keys. */
const EXACT: Record<string, TKey> = {
  'Everything here is picked for your lane.': 'inbox.welcomeBody',
  'Daily limit turned off': 'inbox.limitOff',
  'Set by a parent.': 'inbox.setByParent',
  'Quiet hours on': 'inbox.quietOn',
  'Quiet hours off': 'inbox.quietOff',
  'No videos or games overnight.': 'inbox.quietOvernight',
  'Games are on': 'inbox.gamesOn',
  'Games are off for now': 'inbox.gamesOff',
  'Paused by a parent': 'inbox.paused',
  'Time for something else.': 'inbox.pausedBody',
  "You're back on": 'inbox.unpaused',
  'You’re back on': 'inbox.unpaused',
  'A parent un-paused Payhas.': 'inbox.unpausedBody',
  'A gift from a parent.': 'inbox.gift',
  'Not today': 'inbox.notToday',
  'A parent said no to more time.': 'inbox.notTodayBody',
  'Your video is live': 'inbox.videoLive',
  'Your video wasn’t approved': 'inbox.videoRejected',
  "Your video wasn't approved": 'inbox.videoRejected',
  'A video was taken down': 'inbox.takenDown',
  'Removed after reports': 'inbox.removedAfterReports',
  'It broke the Payhas guidelines.': 'inbox.brokeGuidelines',
};

/** One server-written English line in the current language; unknown text comes back as is. */
export function translateInboxText(text: string, t: T, lang: Lang): string {
  if (lang === 'en' || !text) return text;
  const exact = EXACT[text.trim()];
  if (exact) return t(exact);

  let m: RegExpExecArray | null;
  if ((m = /^Welcome, (.+)$/.exec(text))) return t('inbox.welcome', { name: m[1] });
  if ((m = /^New from (.+)$/.exec(text))) return t('inbox.newFrom', { name: m[1] });
  if ((m = /^New in (.+)$/.exec(text))) {
    const label = m[1];
    if (label === 'your topics') return t('inbox.newIn', { topic: t('inbox.yourTopics') });
    const slug = TOPIC_SLUGS[label] ?? label.toLowerCase();
    return t('inbox.newIn', { topic: topicLabel(t, slug, label) });
  }
  if ((m = /^(.+) sent you a video$/.exec(text))) return t('inbox.sentYou', { name: m[1] });
  if ((m = /^Daily limit set to (\d+) min$/.exec(text))) return t('inbox.limitSet', { n: m[1] });
  if ((m = /^Quiet hours: (\S+) to (\S+)$/.exec(text))) return t('inbox.quietRange', { from: hour(m[1], lang), to: hour(m[2], lang) });
  if ((m = /^No videos from (\S+) to (\S+?)\.$/.exec(text))) return t('inbox.quietNoVideos', { from: hour(m[1], lang), to: hour(m[2], lang) });
  if ((m = /^(\d+) more minutes? today$/.exec(text))) return t('inbox.moreMinutes', { count: Number(m[1]) });
  return text;
}

/**
 * An inbox item's title and body in the app's language. Bodies that are a
 * video caption use the item's caption translations (`body_i18n`), else
 * `caption` when the caller already has the localized caption for its video.
 */
export function translateInbox(item: InboxItem, t: T, lang: Lang, caption?: string): { title: string; body: string } {
  const title = translateInboxText(item.title, t, lang);
  let body: string;
  if (item.kind === 'new_video' && item.body_i18n) body = localized(lang, item.body, item.body_i18n);
  else if ((item.kind === 'new_video' || item.kind === 'shared' || item.kind === 'creator') && caption && item.body !== caption)
    body = caption;
  else body = translateInboxText(item.body, t, lang);
  return { title, body };
}
