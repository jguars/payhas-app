export type Lang = 'en' | 'tk' | 'tr' | 'ru';

export const LANGS: { code: Lang; native: string; english: string }[] = [
  { code: 'tk', native: 'Türkmençe', english: 'Turkmen' },
  { code: 'tr', native: 'Türkçe', english: 'Turkish' },
  { code: 'ru', native: 'Русский', english: 'Russian' },
  { code: 'en', native: 'English', english: 'English' },
];

/** A plural-aware string: `{count}` picks the form. Turkmen and Turkish use one form after numbers. */
export type Plural = { one: string; other: string; few?: string; many?: string };
export type Entry = string | Plural;

/**
 * One namespace of strings, English first; every other language must have
 * every key (the type checker refuses a missing translation). Placeholders
 * are `{name}`; plural entries are objects and take `{count}`.
 */
export function defineStrings<T extends Record<string, Entry>>(en: T, rest: Record<Exclude<Lang, 'en'>, { [K in keyof T]: Entry }>) {
  return { en, ...rest } as Record<Lang, { [K in keyof T]: Entry }>;
}

/** CLDR plural form for the four languages we ship. */
export function pluralForm(lang: Lang, n: number): keyof Plural {
  if (lang === 'ru') {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'one';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'few';
    return 'many';
  }
  if (lang === 'en') return n === 1 ? 'one' : 'other';
  return 'other';
}
