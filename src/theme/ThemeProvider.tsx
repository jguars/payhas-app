import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { applyTheme, color, theme as startTheme, ThemeName } from './tokens';

type Ctx = { theme: ThemeName; setTheme: (next: ThemeName) => void };
const ThemeCtx = createContext<Ctx | null>(null);

/** Where to land after the app redraws in a new theme (the screen the switch was made on). */
let returnTo: string | null = null;

/**
 * Holds the chosen theme. Switching rewrites the colour tokens and remounts
 * the app under a new key, so every screen and sheet redraws in the new
 * palette; then it returns to the screen the switch was made on.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState<ThemeName>(startTheme);

  useEffect(() => {
    // The window behind the app (keyboard gaps, screen transitions) follows the theme too.
    SystemUI.setBackgroundColorAsync(color.bg).catch(() => {});
    if (!returnTo) return;
    const to = returnTo;
    returnTo = null;
    const id = setTimeout(() => {
      try {
        router.navigate(to as never);
      } catch {}
    }, 80);
    return () => clearTimeout(id);
  }, [name]);

  const setTheme = useCallback(
    (next: ThemeName, from = '/me') => {
      if (next === name) return;
      applyTheme(next);
      returnTo = from;
      setName(next);
    },
    [name],
  );

  const value = useMemo(() => ({ theme: name, setTheme }), [name, setTheme]);
  return (
    <ThemeCtx.Provider value={value}>
      <StatusBar style={color.scheme === 'light' ? 'dark' : 'light'} />
      <View key={name} style={{ flex: 1, backgroundColor: color.bg }}>
        {children}
      </View>
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
