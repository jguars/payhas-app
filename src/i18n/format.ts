import type { Lang } from './define';
import type { T } from './index';

/** Turkmen names: neither Android nor browsers ship Turkmen calendar data, so `Intl` would fall back to English. */
const TK_WEEKDAYS = ['Ýekşenbe', 'Duşenbe', 'Sişenbe', 'Çarşenbe', 'Penşenbe', 'Anna', 'Şenbe'];
const TK_MONTHS = ['ýanwar', 'fewral', 'mart', 'aprel', 'maý', 'iýun', 'iýul', 'awgust', 'sentýabr', 'oktýabr', 'noýabr', 'dekabr'];

/** "Friday, October 30" / "Anna, 30 oktýabr" / "30 Ekim Cuma" / "Пятница, 30 октября" — a day as a heading. */
export function formatDay(lang: Lang, date: Date) {
  const s = lang === 'tk' ? `${TK_WEEKDAYS[date.getDay()]}, ${date.getDate()} ${TK_MONTHS[date.getMonth()]}` : date.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * A duration in full words for children and for anything spoken aloud:
 * "1 hour", "45 minutes", "1 hour 15 minutes". Parents' screens use the short
 * `minutes()` form ("1 h 15 min").
 */
export function durationWords(t: T, seconds: number) {
  const m = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return t('play.mins', { count: rest });
  return rest === 0 ? t('play.hours', { count: h }) : `${t('play.hours', { count: h })} ${t('play.mins', { count: rest })}`;
}
