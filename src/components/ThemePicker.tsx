import { Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { TKey, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { useTheme } from '@/theme/ThemeProvider';
import { color, font, previewOf, radius, space, themedStyles, ThemeName, THEMES } from '@/theme/tokens';

const LABEL: Record<ThemeName, TKey> = { dark: 'me.themeDark', navy: 'me.themeNavy', light: 'me.themeLight' };

/**
 * Three theme cards, each a tiny preview drawn in its own palette: the page
 * (with Navy's gradient), a card, two lines of text, the ember button and
 * the four lane dots. Tapping one switches the whole app.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const { t } = useT();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {THEMES.map((name) => {
        const p = previewOf(name);
        const on = name === theme;
        return (
          <PressScale
            key={name}
            onPress={() => {
              fx.tap();
              setTheme(name);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t(LABEL[name])}
            style={[styles.option, on && styles.optionOn]}
          >
            <View
              style={[
                styles.preview,
                { backgroundColor: p.bg, borderColor: p.line },
                p.bgTop !== p.bgBottom && { experimental_backgroundImage: `linear-gradient(180deg, ${p.bgTop}, ${p.bgBottom})` },
              ]}
            >
              <View style={[styles.card, { backgroundColor: p.surface1 }]}>
                <View style={[styles.line, { backgroundColor: p.text, width: '70%' }]} />
                <View style={[styles.line, { backgroundColor: p.text3, width: '45%' }]} />
              </View>
              <View style={styles.dots}>
                {(['little', 'kids', 'teen', 'adult'] as const).map((l) => (
                  <View key={l} style={[styles.dot, { backgroundColor: p.lanes[l] }]} />
                ))}
              </View>
              <View style={[styles.button, { backgroundColor: p.ember }]} />
            </View>
            <View style={styles.labelRow}>
              {on && <Icon name="check" size={14} color={color.ember} strokeWidth={3} />}
              <Text style={[styles.label, on && { color: color.text }]}>{t(LABEL[name])}</Text>
            </View>
          </PressScale>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', gap: space.sm },
  option: { flex: 1, gap: space.sm, padding: 6, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  optionOn: { borderColor: color.ember },
  preview: { height: 112, borderRadius: 12, borderWidth: 1, padding: 8, gap: 8, overflow: 'hidden' },
  card: { borderRadius: 8, padding: 7, gap: 5 },
  line: { height: 5, borderRadius: 3 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  button: { height: 14, borderRadius: radius.pill, marginTop: 'auto' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 20 },
  label: { color: color.text2, fontFamily: font.bold, fontSize: 13 },
}));
