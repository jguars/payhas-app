import { useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

import { border, color, control, font, radius, space, themedStyles, type } from '@/theme/tokens';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Codes people type or read back (PAYH-…, card numbers): the mono face. */
  code?: boolean;
};

/** The one text input: label above, filled box, strong border while focused, hint or error under it. */
export function TextField({ label, hint, error, code, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={color.text3}
        accessibilityLabel={label}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, code && styles.code, focused && styles.focused, !!error && styles.invalid, style]}
      />
      {!!(error || hint) && <Text style={[styles.hint, !!error && { color: color.danger }]}>{error || hint}</Text>}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { gap: space.sm, alignSelf: 'stretch' },
  label: { color: color.text, fontFamily: font.semibold, ...type.small },
  input: {
    minHeight: control.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    borderWidth: border.strong,
    borderColor: color.surface2,
    backgroundColor: color.surface1,
    color: color.text,
    fontFamily: font.semibold,
    ...type.lead,
  },
  code: { fontFamily: font.mono, letterSpacing: 1 },
  focused: { borderColor: color.text2 },
  invalid: { borderColor: color.danger },
  hint: { color: color.text3, fontFamily: font.medium, ...type.small },
}));
