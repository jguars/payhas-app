import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { Icon } from '@/components/Icon';
import { color, font, Lane, lane as lanes } from '@/theme/tokens';

export const AVATARS = ['cat', 'bear', 'bunny', 'fox', 'owl', 'panda'] as const;
export type AvatarKey = (typeof AVATARS)[number];

/** The profile's own avatar when it's one we draw, else one picked steadily from the name. */
export function avatarFor(key: string | null | undefined, name: string): AvatarKey {
  if (key && (AVATARS as readonly string[]).includes(key) && key !== 'cat') return key as AvatarKey;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

type Props = {
  name: string;
  avatar?: string | null;
  lane: Lane;
  size?: number;
  /** Small corner badge: a lock for PIN-protected profiles. */
  locked?: boolean;
  /** A ribbon with the lane name across the bottom (Who's watching). */
  ribbon?: string;
};

const INK = color.ink;

/**
 * A friendly animal face on the profile's lane colour — flat, two-tone,
 * readable at 32 px and charming at 120 px. Replaces initials everywhere.
 */
export function Avatar({ name, avatar, lane, size = 64, locked, ribbon }: Props) {
  const key = avatarFor(avatar, name);
  const tint = lanes[lane].color;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Circle cx={50} cy={50} r={50} fill={tint} />
        <Face kind={key} />
      </Svg>
      {ribbon && (
        <View style={[styles.ribbon, { bottom: -size * 0.04 }]} pointerEvents="none">
          <View style={[styles.ribbonInner, { backgroundColor: tint }]}>
            <Text style={[styles.ribbonText, { fontSize: Math.max(9, size * 0.11) }]} numberOfLines={1}>
              {ribbon}
            </Text>
          </View>
        </View>
      )}
      {locked && (
        <View style={[styles.lock, { width: size * 0.32, height: size * 0.32, borderRadius: size * 0.16 }, ribbon ? { top: -2, bottom: undefined } : null]}>
          <Icon name="lock" size={size * 0.17} color={color.text} strokeWidth={2.6} />
        </View>
      )}
    </View>
  );
}

function Face({ kind }: { kind: AvatarKey }) {
  const eyes = (y = 50, r = 5.5, gap = 15) => (
    <>
      <Circle cx={50 - gap} cy={y} r={r} fill={INK} />
      <Circle cx={50 + gap} cy={y} r={r} fill={INK} />
      <Circle cx={50 - gap + 1.8} cy={y - 1.8} r={1.8} fill="#fff" />
      <Circle cx={50 + gap + 1.8} cy={y - 1.8} r={1.8} fill="#fff" />
    </>
  );
  const smile = (y = 66, w = 9) => <Path d={`M${50 - w} ${y} Q50 ${y + 8} ${50 + w} ${y}`} stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />;
  const cheeks = (
    <>
      <Ellipse cx={27} cy={62} rx={6} ry={4} fill="#fff" opacity={0.45} />
      <Ellipse cx={73} cy={62} rx={6} ry={4} fill="#fff" opacity={0.45} />
    </>
  );

  switch (kind) {
    case 'cat':
      return (
        <>
          <Path d="M18 34 L24 10 L40 24 Z" fill={INK} />
          <Path d="M82 34 L76 10 L60 24 Z" fill={INK} />
          {eyes(50)}
          <Path d="M46 58 L54 58 L50 63 Z" fill={INK} />
          <Path d="M50 63 Q45 69 40 66 M50 63 Q55 69 60 66" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d="M10 56 H28 M10 64 L28 61 M90 56 H72 M90 64 L72 61" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
        </>
      );
    case 'bear':
      return (
        <>
          <Circle cx={22} cy={22} r={11} fill={INK} />
          <Circle cx={78} cy={22} r={11} fill={INK} />
          {eyes(46, 5)}
          <Ellipse cx={50} cy={65} rx={17} ry={13} fill="#fff" opacity={0.55} />
          <Ellipse cx={50} cy={59} rx={6} ry={4.5} fill={INK} />
          {smile(68, 6)}
        </>
      );
    case 'bunny':
      return (
        <>
          <Ellipse cx={36} cy={14} rx={7} ry={17} fill={INK} />
          <Ellipse cx={64} cy={14} rx={7} ry={17} fill={INK} />
          {eyes(52)}
          {cheeks}
          <Path d="M46 60 Q50 57 54 60 Q50 64 46 60 Z" fill={INK} />
          <Path d="M46 66 h8 v7 h-8 Z" fill="#fff" stroke={INK} strokeWidth={2.4} />
          <Path d="M50 66 v7" stroke={INK} strokeWidth={2} />
        </>
      );
    case 'fox':
      return (
        <>
          <Path d="M14 40 L20 8 L42 26 Z" fill={INK} />
          <Path d="M86 40 L80 8 L58 26 Z" fill={INK} />
          <Path d="M50 92 L18 56 Q34 70 50 70 Q66 70 82 56 Z" fill="#fff" opacity={0.6} />
          {eyes(50, 5, 16)}
          <Circle cx={50} cy={70} r={5} fill={INK} />
        </>
      );
    case 'owl':
      return (
        <>
          <Path d="M20 20 L30 34 L36 22 Z M80 20 L70 34 L64 22 Z" fill={INK} />
          <Circle cx={34} cy={48} r={15} fill="#fff" />
          <Circle cx={66} cy={48} r={15} fill="#fff" />
          <Circle cx={34} cy={48} r={7} fill={INK} />
          <Circle cx={66} cy={48} r={7} fill={INK} />
          <Circle cx={36} cy={46} r={2.2} fill="#fff" />
          <Circle cx={68} cy={46} r={2.2} fill="#fff" />
          <Path d="M44 62 L56 62 L50 74 Z" fill={INK} />
        </>
      );
    case 'panda':
      return (
        <>
          <Circle cx={20} cy={22} r={11} fill={INK} />
          <Circle cx={80} cy={22} r={11} fill={INK} />
          <Ellipse cx={33} cy={50} rx={11} ry={13} fill={INK} transform="rotate(-25 33 50)" />
          <Ellipse cx={67} cy={50} rx={11} ry={13} fill={INK} transform="rotate(25 67 50)" />
          <Circle cx={35} cy={49} r={3.5} fill="#fff" />
          <Circle cx={65} cy={49} r={3.5} fill="#fff" />
          <Ellipse cx={50} cy={64} rx={6} ry={4.5} fill={INK} />
          {smile(71, 6)}
        </>
      );
  }
}

const styles = StyleSheet.create({
  ribbon: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  ribbonInner: { borderRadius: 7, borderWidth: 2, borderColor: color.ink, paddingHorizontal: 7, paddingVertical: 1, transform: [{ rotate: '-4deg' }] },
  ribbonText: { color: color.ink, fontFamily: font.bold, letterSpacing: 0.4 },
  lock: { position: 'absolute', right: -2, bottom: -2, backgroundColor: color.surface2, borderWidth: 2, borderColor: color.ink, alignItems: 'center', justifyContent: 'center' },
});
