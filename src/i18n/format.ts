import type { Lang } from './define';

/** Turkmen names: neither Android nor browsers ship Turkmen calendar data, so `Intl` would fall back to English. */
const TK_WEEKDAYS = ['Ýekşenbe', 'Duşenbe', 'Sişenbe', 'Çarşenbe', 'Penşenbe', 'Anna', 'Şenbe'];
const TK_MONTHS = ['ýanwar', 'fewral', 'mart', 'aprel', 'maý', 'iýun', 'iýul', 'awgust', 'sentýabr', 'oktýabr', 'noýabr', 'dekabr'];

/** "Friday, October 30" / "Anna, 30 oktýabr" / "30 Ekim Cuma" / "пятница, 30 октября" — a day as a heading. */
export function formatDay(lang: Lang, date: Date) {
  if (lang === 'tk') return `${TK_WEEKDAYS[date.getDay()]}, ${date.getDate()} ${TK_MONTHS[date.getMonth()]}`;
  return date.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
}
