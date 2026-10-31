import 'expo-sqlite/localStorage/install';

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import type { Lane } from '@/theme/tokens';

import { Entry, Lang, LANGS, pluralForm } from './define';
import { STRINGS, TKey } from './strings';

export { LANGS } from './define';
export type { Lang } from './define';
export type { TKey } from './strings';

export type Params = Record<string, string | number>;
export type T = (key: TKey, params?: Params) => string;

const KEY = 'payhas.lang';
const SUPPORTED = LANGS.map((l) => l.code);

function stored(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && (SUPPORTED as string[]).includes(v) ? (v as Lang) : null;
  } catch {
    return null;
  }
}

/** The phone's language when it's one we ship, else English. */
function deviceLang(): Lang {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    const base = tag.split(/[-_]/)[0];
    return (SUPPORTED as string[]).includes(base) ? (base as Lang) : 'en';
  } catch {
    return 'en';
  }
}

/** True once someone picked a language on this phone (onboarding's first step). */
export const hasChosenLanguage = () => stored() != null;

// Current language for code outside React (notification channel names etc.).
let current: Lang = stored() ?? deviceLang();

/** The language the app started in (fonts are picked from it at launch). */
export const startupLang: Lang = current;

export function translate(lang: Lang, key: string, params?: Params): string {
  const dot = key.indexOf('.');
  const ns = STRINGS[key.slice(0, dot) as keyof typeof STRINGS] as Record<Lang, Record<string, Entry>> | undefined;
  const k = key.slice(dot + 1);
  const entry = ns?.[lang]?.[k] ?? ns?.en?.[k];
  if (entry == null) return key;
  let text: string;
  if (typeof entry === 'string') text = entry;
  else {
    const n = Number(params?.count ?? 0);
    text = entry[pluralForm(lang, n)] ?? entry.other;
  }
  return params ? text.replace(/\{(\w+)\}/g, (m, p) => (params[p] != null ? String(params[p]) : m)) : text;
}

/** Translate outside React, in the language last set. */
export const tNow: T = (key, params) => translate(current, key, params);

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: T; chosen: boolean; unchoose: () => void };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  // Tracked separately: picking the language the phone already uses changes
  // nothing in `lang`, but the first-run screen still has to move on.
  const [chosen, setChosen] = useState(hasChosenLanguage);
  const setLang = useCallback((l: Lang) => {
    current = l;
    try {
      localStorage.setItem(KEY, l);
    } catch {}
    setLangState(l);
    setChosen(true);
  }, []);
  /** Back from sign-in to the first-run screens: the language step shows again (the language itself stays). */
  const unchoose = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    setChosen(false);
  }, []);
  const t = useCallback<T>((key, params) => translate(lang, key, params), [lang]);
  const value = useMemo(() => ({ lang, setLang, t, chosen, unchoose }), [lang, setLang, t, chosen, unchoose]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `const { t, lang } = useT();` then `t('feed.like')` or `t('common.minutes', { count: 5 })`. */
export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>');
  return ctx;
}

/** Lane name in the current language ("Kids" / "Çagalar" / …). */
export const laneKey = (lane: Lane) => `common.lane.${lane}` as TKey;

/** What to call a person: "Parent" for the family owner's own profile, otherwise their lane ("Kids", "Adult"…). */
export const roleKey = (p: { lane: Lane; is_parent?: boolean | null }) => (p.is_parent ? 'common.role.parent' : laneKey(p.lane)) as TKey;

/** A topic's label by slug, falling back to the database label for slugs we don't know yet. */
export function topicLabel(t: T, slug: string, fallback: string) {
  const key = `common.topic.${slug}` as TKey;
  const s = t(key);
  return s === key ? fallback : s;
}

/** Pick the caption for this language from a video's translations. */
export function localized(lang: Lang, base: string, i18n: unknown): string {
  const map = (i18n ?? {}) as Partial<Record<Lang, string>>;
  return map[lang] || base;
}
