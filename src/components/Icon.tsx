import Svg, { Circle, Path } from 'react-native-svg';

import { color as c } from '@/theme/tokens';

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
  | 'star';

type Props = { name: IconName; size?: number; color?: string; filled?: boolean; strokeWidth?: number };

export function Icon({ name, size = 24, color = c.text, filled = false, strokeWidth = 2 }: Props) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const solid = { fill: color };

  const body = (() => {
    switch (name) {
      case 'home':
        return <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" {...(filled ? solid : stroke)} />;
      case 'discover':
        return (
          <>
            <Circle cx={12} cy={12} r={9} {...stroke} />
            <Path d="m15.5 8.5-2 5-5 2 2-5z" {...(filled ? { ...stroke, fill: color } : stroke)} />
          </>
        );
      case 'plus':
        return <Path d="M12 5v14M5 12h14" {...stroke} />;
      case 'inbox':
        return (
          <>
            <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" {...(filled ? { ...stroke, fill: color } : stroke)} />
            <Path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" {...stroke} />
          </>
        );
      case 'me':
        return (
          <>
            <Circle cx={12} cy={8} r={4} {...(filled ? { ...stroke, fill: color } : stroke)} />
            <Path d="M4 21a8 8 0 0 1 16 0" {...(filled ? { ...stroke, fill: color } : stroke)} />
          </>
        );
      case 'search':
        return (
          <>
            <Circle cx={11} cy={11} r={7} {...stroke} />
            <Path d="m20 20-3.5-3.5" {...stroke} />
          </>
        );
      case 'heart':
        return (
          <Path
            d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"
            {...(filled ? solid : stroke)}
          />
        );
      case 'comment':
        return <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z" {...stroke} />;
      case 'save':
        return <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" {...(filled ? { ...stroke, fill: color } : stroke)} />;
      case 'share':
        return <Path d="M14 4l7 7-7 7v-4c-6 0-9 2-11 6 0-7 3-11 11-12z" {...stroke} />;
      case 'shield':
        return (
          <>
            <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...stroke} />
            <Path d="m9 12 2 2 4-4" {...stroke} />
          </>
        );
      case 'verified':
        return (
          <Path
            d="M12 2l2.4 2.2 3.2-.4.9 3.1 2.9 1.5-1 3 1 3-2.9 1.5-.9 3.1-3.2-.4L12 22l-2.4-2.2-3.2.4-.9-3.1-2.9-1.5 1-3-1-3 2.9-1.5.9-3.1 3.2.4z"
            {...solid}
          />
        );
      case 'play':
        return <Path d="M7 4v16l13-8z" {...solid} />;
      case 'close':
        return <Path d="M6 6l12 12M18 6 6 18" {...stroke} />;
      case 'sliders':
        return <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" {...stroke} />;
      case 'moon':
        return <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" {...(filled ? solid : stroke)} />;
      case 'lock':
        return (
          <>
            <Path d="M6 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" {...stroke} />
            <Path d="M8 11V7a4 4 0 0 1 8 0v4" {...stroke} />
          </>
        );
      case 'chevron':
        return <Path d="m9 6 6 6-6 6" {...stroke} />;
      case 'sparkle':
        return <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" {...(filled ? solid : stroke)} />;
      case 'clock':
        return (
          <>
            <Circle cx={12} cy={12} r={9} {...stroke} />
            <Path d="M12 7v5l3 2" {...stroke} />
          </>
        );
      case 'game':
        return (
          <>
            <Path d="M7 7h10a5 5 0 0 1 4.9 6l-.8 4a2.5 2.5 0 0 1-4.3 1.2L14.5 16h-5l-2.3 2.2A2.5 2.5 0 0 1 2.9 17l-.8-4A5 5 0 0 1 7 7z" {...stroke} />
            <Path d="M7.5 10v3M6 11.5h3" {...stroke} />
            <Circle cx={15.5} cy={10.5} r={0.6} {...stroke} />
            <Circle cx={17} cy={12.5} r={0.6} {...stroke} />
          </>
        );
      case 'star':
        return <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" {...(filled ? solid : stroke)} />;
      case 'muted':
        return (
          <>
            <Path d="M11 5 6 9H2v6h4l5 4z" {...stroke} />
            <Path d="m22 9-6 6M16 9l6 6" {...stroke} />
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
