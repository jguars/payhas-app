import { Alert, Platform, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Lang, LANGS, startupLang, translate, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { border, color, font, iconSize, radius, space, themedStyles, type } from '@/theme/tokens';

/**
 * Switch the whole app to `code` and, when signed in, record it for the
 * family (server-side notices use it). Russian swaps in a Cyrillic font that
 * only loads at launch, so a switch to or from it asks for a restart — except
 * on the very first pick, when it simply applies next launch.
 */
export function useChooseLanguage() {
  const { setLang } = useT();
  return (code: Lang, firstRun?: boolean) => {
    setLang(code);
    if (!firstRun && (code === 'ru') !== (startupLang === 'ru')) {
      if (Platform.OS === 'web') globalThis.location?.reload();
      else Alert.alert(translate(code, 'common.restartTitle'), translate(code, 'common.restartBody'));
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.rpc('set_family_language', { p_language: code }).then(() => {});
    });
  };
}

type Props = {
  /** Called after a pick is applied (Me's sheet closes on it). */
  onPicked?: (l: Lang) => void;
  /** Controlled: only mark `value` as chosen and report taps; the screen applies it (first run's Continue). */
  value?: Lang;
  onChange?: (l: Lang) => void;
};

/**
 * The four languages, each written in itself, as one grouped list. The
 * chosen row takes the inverse style with a check; the rest show an empty
 * ring. Without `onChange` a tap switches the app at once.
 */
export function LanguagePicker({ onPicked, value, onChange }: Props) {
  const { lang } = useT();
  const choose = useChooseLanguage();
  const selected = value ?? lang;
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {LANGS.map((l, i) => {
        const on = l.code === selected;
        return (
          <Pressable
            key={l.code}
            onPress={() => {
              fx.tap();
              if (onChange) return onChange(l.code);
              choose(l.code);
              onPicked?.(l.code);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, selected: on }}
            accessibilityLabel={l.native === l.english ? l.native : `${l.native}, ${l.english}`}
            style={({ pressed }) => [styles.row, i > 0 && !on && styles.divider, on && styles.rowOn, pressed && !on && styles.pressed]}
          >
            <View style={styles.text}>
              <Text style={[styles.native, on && styles.onInverse]}>{l.native}</Text>
              <Text style={[styles.english, on && styles.onInverse]}>{l.english}</Text>
            </View>
            {on ? <Icon name="check" size={iconSize.md} color={color.onInverse} strokeWidth={2.6} /> : <View style={styles.ring} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => ({
  list: { borderRadius: radius.card, backgroundColor: color.surface1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: space.xxxl + space.lg, paddingHorizontal: space.lg, gap: space.md },
  divider: { borderTopWidth: border.hairline, borderTopColor: color.line },
  rowOn: { backgroundColor: color.inverse, borderRadius: radius.card },
  pressed: { backgroundColor: color.surface2 },
  text: { flex: 1, gap: space.xs / 2 },
  native: { color: color.text, fontFamily: font.semibold, ...type.lead },
  english: { color: color.text3, fontFamily: font.medium, ...type.small },
  onInverse: { color: color.onInverse },
  ring: { width: iconSize.lg, height: iconSize.lg, borderRadius: radius.pill, borderWidth: border.strong, borderColor: color.line },
}));
