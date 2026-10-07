import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { useInsets } from '@/lib/useInsets';

/** Full-screen container padded clear of the status and gesture bars (see useInsets). */
export function SafeScreen({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const { top, bottom } = useInsets();
  return <View style={[style, { paddingTop: top, paddingBottom: bottom }]}>{children}</View>;
}
