import { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Icon, IconName } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { color, font, iconSize, iconStroke, radius, space, themedStyles, type } from '@/theme/tokens';

/** Nothing here yet: an icon in a soft circle, a title, one line, and at most one action. */
/** `children` go under the text (e.g. suggestion chips), in place of or after the action. */
export function EmptyState({ icon, title, body, action, onAction, children }: { icon: IconName; title: string; body?: string; action?: string; onAction?: () => void; children?: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.circle}>
        <Icon name={icon} size={iconSize.xl} color={color.text2} strokeWidth={iconStroke(iconSize.xl)} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!body && <Text style={styles.body}>{body}</Text>}
      {!!action && <Button label={action} variant="secondary" size="sm" block={false} onPress={onAction} />}
      {children}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl, paddingHorizontal: space.xl },
  circle: { width: 72, height: 72, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface2, marginBottom: space.sm },
  title: { color: color.text, fontFamily: font.title, ...type.lead, textAlign: 'center' },
  body: { color: color.text2, fontFamily: font.medium, ...type.small, textAlign: 'center' },
}));
