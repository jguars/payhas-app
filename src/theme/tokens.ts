/** Payhas design tokens — mirrors the Design System board on the canvas. */
import 'expo-sqlite/localStorage/install';
import { StyleSheet } from 'react-native';

/**
 * Three themes, picked on the Me tab and kept on the device:
 *   dark  — the original Night-Light Playroom: near-black, one ember.
 *   navy  — a premium deep blue with a soft top-to-bottom gradient.
 *   light — calm and low-glare: soft grey-blue paper, never pure white.
 *
 * `color` and `lane` below are live: applyTheme() rewrites them, and every
 * `themedStyles()` sheet rebuilds on its next read. The root remounts on a
 * switch (ThemeProvider), so the whole app redraws in the new palette.
 *
 * Fixed in every theme:
 *   ink   — the dark that sits ON bright fills (ember, lanes, stars): text,
 *           icons and the hand-drawn outlines. Never a page background.
 *   bg    — the page itself; surfaces sit on it.
 *   media — text and scrims over video and posters, always light-on-dark.
 */
export type ThemeName = 'dark' | 'navy' | 'light';
export const THEMES: ThemeName[] = ['dark', 'navy', 'light'];

type Palette = {
  scheme: 'dark' | 'light';
  bg: string;
  /** Top and bottom of the page gradient; equal for a flat theme. */
  bgTop: string;
  bgBottom: string;
  surface1: string;
  surface2: string;
  line: string;
  text: string;
  text2: string;
  text3: string;
  ember: string;
  /** Ember as text or a thin icon on surfaces (links, "Enter it here"). Fills use `ember`. */
  emberText: string;
  emberEdge: string;
  verified: string;
  success: string;
  successSoft: string;
  warning: string;
  danger: string;
  info: string;
  reward: string;
  /** A flipped surface for toasts and selected chips: light on the dark themes, dark on light. */
  inverse: string;
  onInverse: string;
};

const PALETTES: Record<ThemeName, Palette> = {
  dark: {
    scheme: 'dark',
    bg: '#0A0A0F',
    bgTop: '#0A0A0F',
    bgBottom: '#0A0A0F',
    surface1: '#14141B',
    surface2: '#1D1D26',
    line: '#2A2A35',
    text: '#F4F3EF',
    text2: '#B3B2BD',
    text3: '#8C8B97',
    ember: '#FF5A3C',
    emberText: '#FF5A3C',
    emberEdge: '#9E3825',
    verified: '#78A6FF',
    success: '#4FE3B0',
    successSoft: '#E9FBF4',
    warning: '#FFD25E',
    danger: '#FF8A73',
    info: '#78A6FF',
    reward: '#FFD25E',
    inverse: '#F4F3EF',
    onInverse: '#0A0A0F',
  },
  navy: {
    scheme: 'dark',
    bg: '#0E1631',
    bgTop: '#1A2858',
    bgBottom: '#0A1026',
    surface1: '#17224A',
    surface2: '#212E5B',
    line: '#2D3B6B',
    text: '#F2F4FB',
    text2: '#B8C1DC',
    text3: '#97A2C4',
    ember: '#FF5A3C',
    emberText: '#FF7A5F',
    emberEdge: '#9E3825',
    verified: '#8BB4FF',
    success: '#4FE3B0',
    successSoft: '#E9FBF4',
    warning: '#FFD25E',
    danger: '#FF8A73',
    info: '#8BB4FF',
    reward: '#FFD25E',
    inverse: '#F2F4FB',
    onInverse: '#0E1631',
  },
  light: {
    scheme: 'light',
    bg: '#E9ECF1',
    bgTop: '#EEF1F5',
    bgBottom: '#E3E7EE',
    surface1: '#F5F7FA',
    surface2: '#DDE2EA',
    line: '#CBD2DC',
    text: '#1B1E26',
    text2: '#454B5A',
    text3: '#575D6C',
    ember: '#E44D2C',
    emberText: '#B5371B',
    emberEdge: '#9E3825',
    verified: '#2F63D6',
    success: '#0A6E50',
    successSoft: '#DCF3EB',
    warning: '#735300',
    danger: '#AE321C',
    info: '#2452B8',
    reward: '#B98600',
    inverse: '#22252E',
    onInverse: '#F5F7FA',
  },
};

/**
 * Lane colours per theme. `LANE_COLORS` are fills (avatars, lane badges) and
 * always carry ink on top, so they stay bright in every theme. `LANE_TEXT` is
 * the same hue as text on the page: equal to the fill on the dark themes,
 * deepened on light so it passes AA (4.5:1) on bg and both surfaces.
 */
const LANE_COLORS: Record<ThemeName, Record<Lane, string>> = {
  dark: { little: '#FFD25E', kids: '#4FE3B0', teen: '#78A6FF', adult: '#C3A2FF' },
  navy: { little: '#FFD25E', kids: '#4FE3B0', teen: '#8BB4FF', adult: '#C9ABFF' },
  light: { little: '#FFD25E', kids: '#4FE3B0', teen: '#78A6FF', adult: '#C3A2FF' },
};
const LANE_TEXT: Record<ThemeName, Record<Lane, string>> = {
  dark: LANE_COLORS.dark,
  navy: LANE_COLORS.navy,
  light: { little: '#7D5E00', kids: '#0A6E50', teen: '#2452B8', adult: '#6A42C2' },
};

const THEME_KEY = 'payhas.theme';

function storedTheme(): ThemeName {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'navy' || v === 'light' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export let theme: ThemeName = storedTheme();
/** Bumped by applyTheme(); themedStyles() rebuilds when it changes. */
let version = 0;

const FIXED = {
  /** The dark ON bright fills — text, icons and outlines on ember and lane colours. Same in every theme. */
  ink: '#0A0A0F',
  white: '#FFFFFF',
  black: '#000000',
};

export const color: Palette & typeof FIXED = { ...PALETTES[theme], ...FIXED };

/** Over video and posters: light text and dark scrims in every theme. */
export const media = {
  text: '#F4F3EF',
  text2: '#D9D8E0',
  text3: '#B3B2BD',
  scrim: '#0A0A0F',
  surface1: '#14141B',
  surface2: '#1D1D26',
  line: '#2A2A35',
} as const;

/** A token at some opacity: `alpha(color.ember, 0.12)`. Accepts #RRGGBB. */
export function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export type Lane = 'little' | 'kids' | 'teen' | 'adult';

/** `color` is the fill (ink on top); `text` is the same hue as text on the page. */
export const lane: Record<Lane, { label: string; ages: string; color: string; text: string }> = {
  little: { label: 'Little', ages: '0–6', color: LANE_COLORS[theme].little, text: LANE_TEXT[theme].little },
  kids: { label: 'Kids', ages: '7–12', color: LANE_COLORS[theme].kids, text: LANE_TEXT[theme].kids },
  teen: { label: 'Teen', ages: '13–17', color: LANE_COLORS[theme].teen, text: LANE_TEXT[theme].teen },
  adult: { label: 'Adult', ages: '18+', color: LANE_COLORS[theme].adult, text: LANE_TEXT[theme].adult },
};

/** Switch theme: rewrites `color` and `lane`, remembers it, and makes every themed sheet rebuild. */
export function applyTheme(next: ThemeName) {
  theme = next;
  Object.assign(color, PALETTES[next], FIXED);
  for (const l of Object.keys(lane) as Lane[]) {
    lane[l].color = LANE_COLORS[next][l];
    lane[l].text = LANE_TEXT[next][l];
  }
  version += 1;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {}
}

/**
 * A page's background: the theme colour, and on Navy a soft top-to-bottom
 * gradient. Spread it into a screen's root style: `root: { flex: 1, ...pageFill() }`.
 */
export const pageFill = () =>
  color.bgTop === color.bgBottom
    ? { backgroundColor: color.bg }
    : { backgroundColor: color.bg, experimental_backgroundImage: `linear-gradient(180deg, ${color.bgTop} 0%, ${color.bgBottom} 100%)` };

/** The palette a theme would use, e.g. for previews in the theme picker. */
export const previewOf = (name: ThemeName) => ({ ...PALETTES[name], lanes: LANE_COLORS[name] });

/**
 * StyleSheet.create, but rebuilt after a theme switch. Use it instead of
 * StyleSheet.create anywhere styles read `color` or `lane`:
 *   const styles = themedStyles(() => ({ root: { backgroundColor: color.bg } }));
 * Reads like a normal styles object; values follow the current theme.
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(make: () => T & StyleSheet.NamedStyles<T>): T {
  let built: T | null = null;
  let at = -1;
  const current = () => {
    if (at !== version || !built) {
      built = StyleSheet.create(make());
      at = version;
    }
    return built;
  };
  return new Proxy({} as T, {
    get: (_, key) => current()[key as keyof T],
    has: (_, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_, key) => Object.getOwnPropertyDescriptor(current(), key),
  });
}

export const font = {
  display: 'BricolageGrotesque_800ExtraBold',
  title: 'BricolageGrotesque_700Bold',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  mono: 'JetBrainsMono_500Medium',
} as const;

/**
 * The type scale — every text size in the app is one of these nine.
 *   caption 12 · small 14 · body 16 · lead 18 · title 22 · heading 26 ·
 *   headline 30 · display 36 · hero 44
 * Bricolage (font.display / font.title) for headings and big numbers, Figtree
 * (medium / semibold / bold) for everything read or tapped — numbers, times
 * and counts included. Mono only for codes people type or read back
 * (activation codes, card numbers). Sizes inside game pieces scale with the
 * board instead.
 */
export const size = { caption: 12, small: 14, body: 16, lead: 18, title: 22, heading: 26, headline: 30, display: 36, hero: 44 } as const;

/**
 * Line height and tracking per step — use these with `size`, never per screen.
 * Tight tracking on the big Bricolage steps, none on Figtree text.
 */
export const leading = { caption: 16, small: 20, body: 22, lead: 24, title: 28, heading: 32, headline: 36, display: 42, hero: 52 } as const;
export const tracking = { caption: 0.2, small: 0, body: 0, lead: 0, title: -0.3, heading: -0.4, headline: -0.6, display: -0.8, hero: -1.2 } as const;

/** One text style per step: `...type.title` gives fontSize, lineHeight and letterSpacing together. */
export const type = Object.fromEntries(
  (Object.keys(size) as (keyof typeof size)[]).map((k) => [k, { fontSize: size[k], lineHeight: leading[k], letterSpacing: tracking[k] }]),
) as Record<keyof typeof size, { fontSize: number; lineHeight: number; letterSpacing: number }>;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Screen edge padding and the gap between sections. */
export const layout = { gutter: space.lg, section: space.xl } as const;

/**
 * Four radii and nothing else: sm (chips, tiles, inputs), md (cards, rows
 * groups), lg (heroes, video, sheets), pill (buttons, tab bar, badges).
 * `chip` / `card` / `video` are the old names for sm / md / lg.
 */
export const radius = { sm: 12, md: 20, lg: 28, pill: 999, chip: 12, card: 20, video: 28 } as const;

/**
 * Icon sizes, and the stroke that keeps every size at the same optical weight
 * (about 1.8 px on screen). Pass `iconStroke(size)` instead of a per-screen
 * strokeWidth. Illustrations and game pieces are not icons.
 */
export const iconSize = { sm: 16, md: 20, lg: 24, xl: 32 } as const;
export const iconStroke = (px: number) => Math.round(((1.8 * 24) / px) * 10) / 10;

/** Two border widths: hairline for dividers and quiet outlines, strong for focus and selection. */
export const border = { hairline: 1, strong: 2 } as const;

/** Control heights: sm (inline buttons, chips), md (rows, inputs — also the minimum touch target), lg (primary buttons). */
export const control = { sm: 40, md: 48, lg: 56 } as const;

/**
 * Depth. Tonal layers first (bg → surface1 → surface2); the "ledge" is a hard
 * offset under tactile things (child cards, primary buttons); the one soft
 * shadow is for things that float over content (tab bar, toasts, sheets).
 */
export const elevation = {
  ledge: 4,
  ledgeButton: 3,
  float: { shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
} as const;
