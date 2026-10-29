import { Text } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { color } from '@/theme/tokens';

const INK = color.ink;
const W = '#FFFFFF';
const S = 2.6; // outline weight, in the 64-unit box

/**
 * Hand-drawn topic stickers for Discover's catalog tiles: a bold ink outline,
 * a fill in the tile's colour and white highlights — one per interest slug.
 * Unknown slugs fall back to the emoji from the database.
 */
export function TopicIcon({ slug, tint, size = 56, emoji }: { slug: string; tint: string; size?: number; emoji?: string }) {
  const art = ART[slug];
  if (!art) return <Text style={{ fontSize: size * 0.78 }}>{emoji ?? '✨'}</Text>;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {art(tint)}
    </Svg>
  );
}

const line = { stroke: INK, strokeWidth: S, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const ART: Record<string, (c: string) => React.ReactNode> = {
  animals: (c) => (
    <G {...line}>
      <Path d="M32 34c9 0 16 7 16 13 0 6-5 9-9 8-3-1-4-3-7-3s-4 2-7 3c-4 1-9-2-9-8 0-6 7-13 16-13z" fill={c} />
      <Ellipse cx={15} cy={27} rx={6} ry={7.5} fill={c} transform="rotate(-18 15 27)" />
      <Ellipse cx={26} cy={16} rx={6} ry={8} fill={c} transform="rotate(-6 26 16)" />
      <Ellipse cx={38} cy={16} rx={6} ry={8} fill={c} transform="rotate(6 38 16)" />
      <Ellipse cx={49} cy={27} rx={6} ry={7.5} fill={c} transform="rotate(18 49 27)" />
      <Path d="M27 41c2-2 5-3 8-2" stroke={W} strokeWidth={2.4} fill="none" />
    </G>
  ),
  rhymes: (c) => (
    <G {...line}>
      <Path d="M24 46V16M50 10v30" stroke={c} strokeWidth={3.4} fill="none" />
      <Path d="M24 16l26-6v8l-26 6z" fill={c} />
      <Ellipse cx={18} cy={47} rx={8} ry={6.5} fill={c} transform="rotate(-18 18 47)" />
      <Ellipse cx={44} cy={41} rx={8} ry={6.5} fill={c} transform="rotate(-18 44 41)" />
      <Circle cx={16} cy={45.5} r={1.6} fill={W} stroke="none" />
      <Circle cx={42} cy={39.5} r={1.6} fill={W} stroke="none" />
    </G>
  ),
  stories: (c) => (
    <G {...line}>
      <Path d="M6 18c9-3 18-2 26 4 8-6 17-7 26-4v32c-9-3-18-2-26 4-8-6-17-7-26-4z" fill={c} />
      <Path d="M10 20c7-2 15-1 22 4v26c-7-5-15-6-22-4z" fill={W} />
      <Path d="M54 20c-7-2-15-1-22 4v26c7-5 15-6 22-4z" fill={W} />
      <Path d="M15 29c4-1 8-1 12 1M15 36c4-1 8-1 12 1M37 30c4-2 8-2 12-1M37 37c4-2 8-2 12-1" strokeWidth={2} fill="none" />
    </G>
  ),
  play: (c) => (
    <G {...line}>
      <Circle cx={32} cy={33} r={21} fill={c} />
      <Path d="M32 12c-6 6-8 14-8 21s2 15 8 21M32 12c6 6 8 14 8 21s-2 15-8 21" fill="none" />
      <Path d="M13 26c6 3 12 4 19 4s13-1 19-4" fill="none" />
      <Path d="M20 20c3-3 7-5 11-5" stroke={W} strokeWidth={3} fill="none" />
    </G>
  ),
  puppets: (c) => (
    <G {...line}>
      <Path d="M18 58V30c0-11 6-20 15-20s15 7 15 16v4l-9 3 9 4v21z" fill={c} />
      <Path d="M48 30l-9 3 9 4" fill={INK} />
      <Circle cx={31} cy={22} r={5.5} fill={W} />
      <Circle cx={32} cy={23} r={2.5} fill={INK} stroke="none" />
      <Path d="M18 48h30M18 53h30" strokeWidth={2} fill="none" />
    </G>
  ),
  learning: (c) => (
    <G {...line}>
      <Path d="M12 22l20-10 20 10v24L32 56 12 46z" fill={c} />
      <Path d="M12 22l20 10 20-10M32 32v24" fill="none" />
      <Path d="M18 45l4-12 4 12M19.5 41h5" strokeWidth={2.2} fill="none" />
      <Path d="M38 36v12M38 36h3.5a3 3 0 0 1 0 6H38M38 42h4a3 3 0 0 1 0 6h-4" strokeWidth={2.2} fill="none" />
      <Path d="M24 18l8-4 8 4" stroke={W} strokeWidth={2.4} fill="none" />
    </G>
  ),
  nature: (c) => (
    <G {...line}>
      <Path d="M32 56V30" stroke={c} strokeWidth={3.4} fill="none" />
      <Path d="M32 34C32 22 22 14 10 14c0 12 9 20 22 20z" fill={c} />
      <Path d="M32 28c0-10 9-17 22-17 0 11-8 18-22 18z" fill={c} />
      <Path d="M14 18c5 3 10 7 14 12M50 15c-5 2-9 6-12 10" strokeWidth={2} fill="none" />
      <Path d="M18 56h28" stroke={c} strokeWidth={3.4} fill="none" />
    </G>
  ),
  space: (c) => (
    <G {...line}>
      <Path d="M32 6c9 7 13 17 12 30l-6 8H26l-6-8c-1-13 3-23 12-30z" fill={W} />
      <Path d="M20 36l-7 8 9-1zM44 36l7 8-9-1z" fill={c} />
      <Circle cx={32} cy={24} r={5.5} fill={c} />
      <Path d="M27 44c0 5 2 9 5 13 3-4 5-8 5-13z" fill={color.ember} />
      <Path d="M26 12c2-2 4-3.5 6-4.5" stroke={c} strokeWidth={2.4} fill="none" />
    </G>
  ),
  drawing: (c) => (
    <G {...line}>
      <Path d="M44 8l12 12-28 28-14 2 2-14z" fill={c} />
      <Path d="M16 36l12 12M38 14l12 12" fill="none" />
      <Path d="M18 48l-2 2" strokeWidth={4} />
      <Path d="M8 58c6-4 10 2 16-2s10-2 14 0" stroke={c} fill="none" strokeWidth={3} />
      <Path d="M46 13l5 5" stroke={W} strokeWidth={2.4} fill="none" />
    </G>
  ),
  science: (c) => (
    <G {...line}>
      <Path d="M25 8h14M27 8v16L13 50a5 5 0 0 0 4.5 7h29a5 5 0 0 0 4.5-7L37 24V8" fill={W} />
      <Path d="M19 40h26l6 10a5 5 0 0 1-4.5 7h-29A5 5 0 0 1 13 50z" fill={c} />
      <Circle cx={28} cy={47} r={2.5} fill={W} />
      <Circle cx={37} cy={51} r={1.8} fill={W} />
      <Circle cx={44} cy={30} r={3} fill={c} />
      <Circle cx={50} cy={22} r={2} fill={c} />
    </G>
  ),
  sports: (c) => (
    <G {...line}>
      <Circle cx={32} cy={32} r={23} fill={W} />
      <Path d="M32 22l9 6-3 10H26l-3-10z" fill={c} />
      <Path d="M32 22V10M41 28l11-4M38 38l7 10M26 38l-7 10M23 28l-11-4" fill="none" />
    </G>
  ),
  building: (c) => (
    <G {...line}>
      <Rect x={10} y={38} width={44} height={16} rx={3} fill={c} />
      <Rect x={18} y={22} width={28} height={16} rx={3} fill={W} />
      <Rect x={14} y={33} width={7} height={5} rx={2} fill={c} />
      <Rect x={28.5} y={33} width={7} height={5} rx={2} fill={c} />
      <Rect x={43} y={33} width={7} height={5} rx={2} fill={c} />
      <Rect x={22} y={17} width={7} height={5} rx={2} fill={W} />
      <Rect x={35} y={17} width={7} height={5} rx={2} fill={W} />
    </G>
  ),
  gaming: (c) => (
    <G {...line}>
      <Path d="M18 20h28c8 0 12 8 13 18 1 9-3 14-8 14-4 0-6-3-8-7H21c-2 4-4 7-8 7-5 0-9-5-8-14 1-10 5-18 13-18z" fill={c} />
      <Path d="M19 29v10M14 34h10" fill="none" />
      <Circle cx={43} cy={30} r={2.6} fill={W} />
      <Circle cx={49} cy={36} r={2.6} fill={W} />
      <Path d="M20 24h8" stroke={W} strokeWidth={2.4} fill="none" />
    </G>
  ),
  music: (c) => (
    <G {...line}>
      <Path d="M12 38v-6a20 20 0 0 1 40 0v6" stroke={c} strokeWidth={5} fill="none" />
      <Rect x={8} y={36} width={12} height={20} rx={5} fill={c} />
      <Rect x={44} y={36} width={12} height={20} rx={5} fill={c} />
      <Path d="M12 42v8M48 42v8" stroke={W} strokeWidth={2.4} fill="none" />
    </G>
  ),
  fashion: (c) => (
    <G {...line}>
      <Path d="M6 44c0-5 3-8 8-8 4 0 7-6 9-12l9 4c4 2 8 4 14 5 7 1 12 5 12 11v4H6z" fill={c} />
      <Path d="M6 48h52v4a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" fill={W} />
      <Path d="M25 30l4 3M30 28l4 3M35 30l4 3" strokeWidth={2.2} fill="none" />
    </G>
  ),
  comedy: (c) => (
    <G {...line}>
      <Circle cx={32} cy={32} r={23} fill={c} />
      <Path d="M20 27c2-3 6-3 8 0M36 27c2-3 6-3 8 0" fill="none" />
      <Path d="M19 35h26c0 8-6 13-13 13s-13-5-13-13z" fill={INK} />
      <Path d="M24 43c4 3 12 3 16 0" stroke={color.ember} strokeWidth={3} fill="none" />
      <Path d="M17 18c3-3 7-5 11-5" stroke={W} strokeWidth={2.6} fill="none" />
    </G>
  ),
  cooking: (c) => (
    <G {...line}>
      <Path d="M46 34l12-6" stroke="#4A4A58" strokeWidth={6} />
      <Ellipse cx={28} cy={38} rx={20} ry={14} fill="#4A4A58" />
      <Ellipse cx={28} cy={38} rx={15} ry={10} fill="#2C2C36" stroke="none" />
      <Path d="M18 36c0-6 5-9 10-9 6 0 11 3 11 8s-5 9-11 9-10-3-10-8z" fill={W} />
      <Circle cx={28} cy={36} r={5} fill={c} />
      <Circle cx={26.5} cy={34.5} r={1.4} fill={W} stroke="none" />
    </G>
  ),
  news: (c) => (
    <G {...line}>
      <Rect x={14} y={12} width={38} height={42} rx={4} fill={W} />
      <Path d="M14 22H8v26a6 6 0 0 0 12 0" fill={W} />
      <Rect x={20} y={18} width={26} height={9} rx={2} fill={c} />
      <Path d="M20 34h12M20 40h12M20 46h12" strokeWidth={2.2} fill="none" />
      <Rect x={36} y={33} width={10} height={14} rx={2} fill={c} />
    </G>
  ),
};
