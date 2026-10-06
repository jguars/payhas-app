/** Payhas design tokens — mirrors the Design System board on the canvas. */

export const color = {
  ink: '#0A0A0F',
  surface1: '#14141B',
  surface2: '#1D1D26',
  line: '#2A2A35',
  text: '#F4F3EF',
  text2: '#B3B2BD',
  text3: '#8C8B97',
  ember: '#FF5A3C', // the only action colour — always carries ink text
  verified: '#78A6FF',
} as const;

export type Lane = 'little' | 'kids' | 'teen' | 'adult';

export const lane: Record<Lane, { label: string; ages: string; color: string }> = {
  little: { label: 'Little', ages: '0–6', color: '#FFD25E' },
  kids: { label: 'Kids', ages: '7–12', color: '#4FE3B0' },
  teen: { label: 'Teen', ages: '13–17', color: '#78A6FF' },
  adult: { label: 'Adult', ages: '18+', color: '#C3A2FF' },
};

export const font = {
  display: 'BricolageGrotesque_800ExtraBold',
  title: 'BricolageGrotesque_700Bold',
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  mono: 'JetBrainsMono_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { chip: 12, card: 20, video: 28, pill: 999 } as const;

export const tabBarHeight = 56; // excludes the bottom safe-area inset
