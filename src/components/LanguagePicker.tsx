import { Alert, Platform, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Enter } from '@/components/motion/Enter';
import { Lang, LANGS, startupLang, translate, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { color, font, radius, space, themedStyles } from '@/theme/tokens';

/**
 * The four languages, each written in itself. Picking one switches the whole
 * app at once and, when signed in, records it for the family (server-side
 * notices use it).
 */
export function LanguagePicker({ onPicked, firstRun }: { onPicked?: (l: Lang) => void; firstRun?: boolean }) {
  const { lang, setLang } = useT();
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {LANGS.map((l, i) => {
        const on = l.code === lang;
        return (
          <Enter key={l.code} index={i}>
            <Pressable
              onPress={() => {
                fx.tap();
                setLang(l.code);
                // Russian swaps in a Cyrillic font, which only loads at launch.
                // On the very first pick there's nothing to restart for yet; it applies next launch.
                if (!firstRun && (l.code === 'ru') !== (startupLang === 'ru')) {
                  if (Platform.OS === 'web') globalThis.location?.reload();
                  else Alert.alert(translate(l.code, 'common.restartTitle'), translate(l.code, 'common.restartBody'));
                }
                supabase.auth.getSession().then(({ data }) => {
                  if (data.session) supabase.rpc('set_family_language', { p_language: l.code }).then(() => {});
                });
                onPicked?.(l.code);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${l.native}, ${l.english}`}
            >
              {({ pressed }) => (
                <View style={{ paddingBottom: LEDGE }}>
                  <View style={[styles.ledge, on && { backgroundColor: EMBER_EDGE }]} />
                  <View style={[styles.row, on && styles.rowOn, { transform: [{ translateY: pressed ? LEDGE : 0 }] }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.native}>{l.native}</Text>
                      {l.native !== l.english && <Text style={styles.english}>{l.english}</Text>}
                    </View>
                    <View style={[styles.check, on && styles.checkOn]}>{on && <Icon name="check" size={14} color={color.ink} strokeWidth={3} />}</View>
                  </View>
                </View>
              )}
            </Pressable>
          </Enter>
        );
      })}
    </View>
  );
}

/** The hard ledge under each row (same as `Chip`), darker ember when chosen. */
const LEDGE = 4;
const EMBER_EDGE = color.emberEdge;

const styles = themedStyles(() => ({
  list: { gap: space.sm },
  ledge: { position: 'absolute', left: 0, right: 0, top: LEDGE, bottom: 0, borderRadius: radius.card, backgroundColor: color.line },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: space.lg, borderRadius: radius.card, backgroundColor: color.surface1, borderWidth: 2, borderColor: color.line },
  rowOn: { borderColor: color.ember },
  native: { color: color.text, fontFamily: font.title, fontSize: 20 },
  english: { color: color.text3, fontFamily: font.medium, fontSize: 13 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: color.ember, borderColor: color.ember },
}));
