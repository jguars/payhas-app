import Svg, { Circle, Path } from 'react-native-svg';

import { alpha, color, color as c } from '@/theme/tokens';

export type IconName =
  | 'home'
  | 'discover'
  | 'plus'
  | 'inbox'
  | 'me'
  | 'search'
  | 'heart'
  | 'comment'
  | 'save'
  | 'share'
  | 'shield'
  | 'verified'
  | 'muted'
  | 'play'
  | 'close'
  | 'sliders'
  | 'moon'
  | 'lock'
  | 'chevron'
  | 'sparkle'
  | 'clock'
  | 'game'
  | 'star'
  | 'smile'
  | 'link'
  | 'flag'
  | 'eyeOff'
  | 'help'
  | 'check'
  | 'send'
  | 'more'
  | 'back'
  | 'sound'
  | 'vibrate'
  | 'pause'
  | 'minus';

type Props = { name: IconName; size?: number; color?: string; filled?: boolean; strokeWidth?: number };

/** The white highlight a filled icon carries — same glint as the topic stickers and nav icons. */
const GLINT = alpha(color.white, 0.6);

/**
 * Payhas UI glyphs — drawn in the same hand-made family as `NavIcon` and
 * `TopicIcon`: soft rounded shapes, round caps, a slightly chunky line, and a
 * white glint on the filled ones. Small enough for chips and rows, so no ink
 * outline (it would vanish on the dark ground).
 */
export function Icon({ name, size = 24, color = c.text, filled = false, strokeWidth = 2.1 }: Props) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const fillable = filled ? { ...stroke, fill: color } : stroke;
  const glint = (d: string) => (filled ? <Path d={d} stroke={GLINT} strokeWidth={1.6} strokeLinecap="round" fill="none" /> : null);

  const body = (() => {
    switch (name) {
      case 'home':
        return (
          <>
            <Path d="M3.8 11.2 12 4l8.2 7.2v8.3a1.6 1.6 0 0 1-1.6 1.6h-3.7v-5.6H9.1v5.6H5.4a1.6 1.6 0 0 1-1.6-1.6z" {...fillable} />
            {glint('M7 11.4 11 8')}
          </>
        );
      case 'discover':
        return (
          <>
            <Circle cx={12} cy={12} r={9} {...stroke} />
            <Path d="M15.6 8.4 13.7 13.7 8.4 15.6 10.3 10.3z" {...fillable} />
          </>
        );
      case 'plus':
        return <Path d="M12 5.5v13M5.5 12h13" {...stroke} />;
      case 'inbox':
        return (
          <>
            <Path d="M6 16.4V11a6 6 0 1 1 12 0v5.4l1.7 2.1H4.3z" {...fillable} />
            <Path d="M10 20.6a2 2 0 0 0 4 0" {...stroke} />
            {glint('M9.2 9.6a3 3 0 0 1 2.4-2.3')}
          </>
        );
      case 'me':
        return (
          <>
            <Circle cx={12} cy={8.6} r={3.9} {...fillable} />
            <Path d="M4.6 20.2a7.4 7.4 0 0 1 14.8 0z" {...fillable} />
          </>
        );
      case 'search':
        return (
          <>
            <Circle cx={10.8} cy={10.8} r={6.6} {...stroke} />
            <Path d="m16 16 4.2 4.2" {...stroke} strokeWidth={strokeWidth + 0.6} />
            <Path d="M7.6 9.4a3.4 3.4 0 0 1 2.4-2.2" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={0.5} />
          </>
        );
      case 'heart':
        return (
          <>
            <Path d="M12 20.2S3.4 15 3.4 9.1A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.6 2.3C20.6 15 12 20.2 12 20.2z" {...fillable} />
            {glint('M6.4 8.6a2.2 2.2 0 0 1 1.9-1.6')}
          </>
        );
      case 'comment':
        return (
          <>
            <Path d="M12 4c4.8 0 8.6 3.2 8.6 7.3s-3.8 7.3-8.6 7.3c-1 0-2-.1-2.9-.4L5 20l.9-3.7c-1.6-1.3-2.5-3-2.5-5C3.4 7.2 7.2 4 12 4z" {...fillable} />
            {glint('M7.4 9.2a4.6 4.6 0 0 1 2.6-2.3')}
          </>
        );
      case 'save':
        return (
          <>
            <Path d="M7 3.6h10a1.8 1.8 0 0 1 1.8 1.8v14.4a.6.6 0 0 1-1 .5L12 16.2l-5.8 4.1a.6.6 0 0 1-1-.5V5.4A1.8 1.8 0 0 1 7 3.6z" {...fillable} />
            {glint('M8.6 6.6v4')}
          </>
        );
      case 'share':
        return <Path d="M13.6 4.6a.7.7 0 0 1 1.2-.5l6.3 6.3a.9.9 0 0 1 0 1.3l-6.3 6.3a.7.7 0 0 1-1.2-.5v-3.4c-5 0-8 1.6-10.2 5.2.4-6.4 3.6-10.5 10.2-11.3z" {...fillable} />;
      case 'shield':
        return (
          <>
            <Path d="M12 21.4s7.6-3.4 7.6-9.6V6.2a1 1 0 0 0-.7-1L12.3 3a1 1 0 0 0-.6 0L5.1 5.2a1 1 0 0 0-.7 1v5.6c0 6.2 7.6 9.6 7.6 9.6z" {...stroke} />
            <Path d="m8.8 12 2.3 2.3 4.2-4.4" {...stroke} />
          </>
        );
      case 'verified':
        return (
          <>
            <Path
              d="M12 2.4c.7 0 1.3.4 1.8.9l.6.6c.4.4 1 .6 1.6.5l.8-.1a2.3 2.3 0 0 1 2.5 1.8l.2.8c.1.6.5 1 1 1.3l.7.4a2.3 2.3 0 0 1 .9 2.9l-.3.7a2 2 0 0 0 0 1.6l.3.7a2.3 2.3 0 0 1-.9 2.9l-.7.4c-.5.3-.9.7-1 1.3l-.2.8a2.3 2.3 0 0 1-2.5 1.8l-.8-.1c-.6-.1-1.2.1-1.6.5l-.6.6a2.3 2.3 0 0 1-3.6 0l-.6-.6c-.4-.4-1-.6-1.6-.5l-.8.1a2.3 2.3 0 0 1-2.5-1.8l-.2-.8c-.1-.6-.5-1-1-1.3l-.7-.4a2.3 2.3 0 0 1-.9-2.9l.3-.7a2 2 0 0 0 0-1.6l-.3-.7a2.3 2.3 0 0 1 .9-2.9l.7-.4c.5-.3.9-.7 1-1.3l.2-.8A2.3 2.3 0 0 1 7.2 4.1l.8.1c.6.1 1.2-.1 1.6-.5l.6-.6c.5-.5 1.1-.7 1.8-.7z"
              fill={color}
            />
            <Path d="m8.6 12.2 2.3 2.3 4.5-4.6" stroke={c.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        );
      case 'play':
        return (
          <>
            <Path d="M7.2 5.2a1.2 1.2 0 0 1 1.8-1l10.4 6.8a1.2 1.2 0 0 1 0 2L9 19.8a1.2 1.2 0 0 1-1.8-1z" fill={color} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
          </>
        );
      case 'pause':
        return <Path d="M8.5 5.5v13M15.5 5.5v13" {...stroke} strokeWidth={strokeWidth + 1} />;
      case 'minus':
        return <Path d="M5.5 12h13" {...stroke} />;
      case 'close':
        return <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...stroke} />;
      case 'sliders':
        return (
          <>
            <Path d="M4 7h7M17 7h3M4 17h3M13 17h7" {...stroke} />
            <Circle cx={14} cy={7} r={2.6} {...fillable} />
            <Circle cx={10} cy={17} r={2.6} {...fillable} />
          </>
        );
      case 'moon':
        return (
          <>
            <Path d="M19.8 14.6A8.2 8.2 0 1 1 9.4 4.2a6.6 6.6 0 0 0 10.4 10.4z" {...fillable} />
            {glint('M6.6 10.6a5 5 0 0 1 1.6-3')}
          </>
        );
      case 'lock':
        return (
          <>
            <Path d="M7.6 10.6V8a4.4 4.4 0 0 1 8.8 0v2.6" {...stroke} />
            <Path d="M6.4 10.6h11.2a1.8 1.8 0 0 1 1.8 1.8v6a1.8 1.8 0 0 1-1.8 1.8H6.4a1.8 1.8 0 0 1-1.8-1.8v-6a1.8 1.8 0 0 1 1.8-1.8z" {...fillable} />
            <Path d="M12 14.4v2" stroke={filled ? c.ink : color} strokeWidth={strokeWidth} strokeLinecap="round" />
          </>
        );
      case 'chevron':
        return <Path d="m9.5 6 6 6-6 6" {...stroke} strokeWidth={strokeWidth + 0.3} />;
      case 'back':
        return <Path d="m14.5 6-6 6 6 6" {...stroke} strokeWidth={strokeWidth + 0.3} />;
      case 'sparkle':
        return (
          <>
            <Path d="M11 3.6c.6 3.8 2 5.2 5.8 5.8-3.8.6-5.2 2-5.8 5.8-.6-3.8-2-5.2-5.8-5.8 3.8-.6 5.2-2 5.8-5.8z" {...fillable} />
            <Path d="M18 14.6c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8z" {...fillable} />
          </>
        );
      case 'clock':
        return (
          <>
            <Circle cx={12} cy={12} r={8.6} {...fillable} />
            <Path d="M12 7.6V12l2.8 1.8" stroke={filled ? c.ink : color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        );
      case 'game':
        return (
          <>
            <Path d="M7.2 7.4h9.6a4.4 4.4 0 0 1 4.3 3.5l.9 4.7a2.6 2.6 0 0 1-4.6 2.1L15.8 16H8.2l-1.6 1.7A2.6 2.6 0 0 1 2 15.6l.9-4.7a4.4 4.4 0 0 1 4.3-3.5z" {...fillable} />
            <Path d="M8 10.3v3.4M6.3 12h3.4" stroke={filled ? c.ink : color} strokeWidth={strokeWidth} strokeLinecap="round" />
            <Circle cx={15.6} cy={10.9} r={1.05} fill={filled ? c.ink : color} />
            <Circle cx={17.6} cy={13} r={1.05} fill={filled ? c.ink : color} />
          </>
        );
      case 'star':
        return (
          <>
            <Path d="M11.1 3.9a1 1 0 0 1 1.8 0l2.1 4.3 4.7.7a1 1 0 0 1 .6 1.7l-3.4 3.3.8 4.7a1 1 0 0 1-1.5 1L12 17.4l-4.2 2.2a1 1 0 0 1-1.5-1l.8-4.7-3.4-3.3a1 1 0 0 1 .6-1.7l4.7-.7z" {...fillable} />
            {glint('M9.4 10.2 10.6 7.8')}
          </>
        );
      case 'smile':
        return (
          <>
            <Circle cx={12} cy={12} r={8.6} {...stroke} />
            <Path d="M8.4 13.8c.8 1.6 2.1 2.4 3.6 2.4s2.8-.8 3.6-2.4" {...stroke} />
            <Circle cx={9.2} cy={9.8} r={1.1} fill={color} />
            <Circle cx={14.8} cy={9.8} r={1.1} fill={color} />
          </>
        );
      case 'link':
        return (
          <>
            <Path d="M10.2 13.8a3.8 3.8 0 0 0 5.4 0l3-3a3.8 3.8 0 0 0-5.4-5.4l-.9.9" {...stroke} />
            <Path d="M13.8 10.2a3.8 3.8 0 0 0-5.4 0l-3 3a3.8 3.8 0 0 0 5.4 5.4l.9-.9" {...stroke} />
          </>
        );
      case 'flag':
        return (
          <>
            <Path d="M5.6 20.6V4.4" {...stroke} />
            <Path d="M5.6 4.8c3-1.6 5.4 1.4 8.4 0s4.2-.6 4.2-.6v8.4s-1.2-.8-4.2.6-5.4-1.6-8.4 0z" {...fillable} />
          </>
        );
      case 'eyeOff':
        return (
          <>
            <Path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12z" {...stroke} />
            <Circle cx={12} cy={12} r={2.8} {...stroke} />
            <Path d="M4 4l16 16" {...stroke} />
          </>
        );
      case 'help':
        return (
          <>
            <Circle cx={12} cy={12} r={8.6} {...stroke} />
            <Path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4" {...stroke} />
            <Circle cx={12} cy={16.8} r={1.1} fill={color} />
          </>
        );
      case 'check':
        return <Path d="m5.4 12.6 4.2 4.2 9-9.4" {...stroke} strokeWidth={strokeWidth + 0.3} />;
      case 'send':
        return (
          <>
            <Path d="M20.2 3.8a.6.6 0 0 1 .8.8l-6.4 15.6a.6.6 0 0 1-1.1 0L10.6 14 4.4 11.1a.6.6 0 0 1 0-1.1z" {...fillable} />
            <Path d="M20.4 3.6 10.6 14" stroke={filled ? c.ink : color} strokeWidth={strokeWidth * 0.8} strokeLinecap="round" />
          </>
        );
      case 'more':
        return (
          <>
            <Circle cx={5.4} cy={12} r={1.8} fill={color} />
            <Circle cx={12} cy={12} r={1.8} fill={color} />
            <Circle cx={18.6} cy={12} r={1.8} fill={color} />
          </>
        );
      case 'sound':
        return (
          <>
            <Path d="M4 9.4h2.6L10.4 6a.6.6 0 0 1 1 .5v11a.6.6 0 0 1-1 .5l-3.8-3.4H4a1 1 0 0 1-1-1v-3.2a1 1 0 0 1 1-1z" {...fillable} />
            <Path d="M15 9a4.2 4.2 0 0 1 0 6M17.8 6.4a8 8 0 0 1 0 11.2" {...stroke} />
          </>
        );
      case 'muted':
        return (
          <>
            <Path d="M4 9.4h2.6L10.4 6a.6.6 0 0 1 1 .5v11a.6.6 0 0 1-1 .5l-3.8-3.4H4a1 1 0 0 1-1-1v-3.2a1 1 0 0 1 1-1z" {...fillable} />
            <Path d="m15.4 9.6 4.8 4.8M20.2 9.6l-4.8 4.8" {...stroke} />
          </>
        );
      case 'vibrate':
        return (
          <>
            <Path d="M9.4 3.8h5.2a1.6 1.6 0 0 1 1.6 1.6v13.2a1.6 1.6 0 0 1-1.6 1.6H9.4a1.6 1.6 0 0 1-1.6-1.6V5.4a1.6 1.6 0 0 1 1.6-1.6z" {...fillable} />
            <Path d="M4.4 9v6M19.6 9v6" {...stroke} />
          </>
        );
    }
  })();

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}
