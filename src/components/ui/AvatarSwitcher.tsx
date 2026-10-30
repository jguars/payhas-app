import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { fx } from '@/lib/feedback';
import { border, color, font, iconSize, iconStroke, radius, space, themedStyles, type, type Lane } from '@/theme/tokens';

import { Avatar } from './Avatar';

export type SwitcherItem = {
  id: string;
  name: string;
  avatar: string | null;
  lane: Lane;
  /** An ember dot: something here needs the parent (a time request, a flag). */
  alert?: boolean;
  /** Spoken with the name, e.g. "needs you". */
  alertLabel?: string;
};

const SIZE = 64;

/**
 * A row of people to switch between (the Family dashboard's children, after
 * Greenlight). The selected one wears the one selected style: an inverse ring.
 * An optional dashed "Add" slot ends the row. Scrolls sideways past four.
 */
export function AvatarSwitcher({
  items,
  selected,
  onSelect,
  addLabel,
  onAdd,
}: {
  items: SwitcherItem[];
  selected: string | null;
  onSelect: (id: string) => void;
  addLabel?: string;
  onAdd?: () => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
      {items.map((it) => {
        const on = it.id === selected;
        return (
          <Pressable
            key={it.id}
            onPress={() => {
              if (!on) fx.tab();
              onSelect(it.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.alert && it.alertLabel ? `${it.name}, ${it.alertLabel}` : it.name}
            style={styles.item}
          >
            <View style={[styles.ring, on && styles.ringOn]}>
              <Avatar name={it.name} avatar={it.avatar} lane={it.lane} size={SIZE} />
              {it.alert && <View style={styles.alert} />}
            </View>
            <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {it.name}
            </Text>
          </Pressable>
        );
      })}
      {onAdd && addLabel && (
        <Pressable
          onPress={() => {
            fx.tap();
            onAdd();
          }}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={styles.item}
        >
          <View style={styles.ring}>
            <View style={styles.add}>
              <Icon name="plus" size={iconSize.lg} color={color.text3} strokeWidth={iconStroke(iconSize.lg)} />
            </View>
          </View>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {addLabel}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const RING = SIZE + (border.strong + space.xs / 2) * 2;

const styles = themedStyles(() => ({
  row: { gap: space.lg, paddingVertical: space.xs },
  item: { alignItems: 'center', gap: space.xs, width: RING },
  ring: { width: RING, height: RING, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: border.strong, borderColor: 'transparent' },
  ringOn: { borderColor: color.inverse },
  alert: { position: 'absolute', right: space.xs / 2, top: space.xs / 2, width: space.md, height: space.md, borderRadius: radius.pill, backgroundColor: color.ember, borderWidth: border.strong, borderColor: color.bg },
  add: { width: SIZE, height: SIZE, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: border.strong, borderStyle: 'dashed', borderColor: color.line },
  name: { color: color.text2, fontFamily: font.semibold, ...type.small, maxWidth: RING },
  nameOn: { color: color.text },
}));
