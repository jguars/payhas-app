import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold, Onest_800ExtraBold } from '@expo-google-fonts/onest';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/Toast';
import { FamilyProvider, useFamily } from '@/features/family/FamilyProvider';
import { usePresence } from '@/features/family/usePresence';
import { I18nProvider, startupLang, useT } from '@/i18n';
import { useParentAlerts } from '@/features/parent/push';
import { LibraryProvider } from '@/features/library/LibraryProvider';
import { initFeedback } from '@/lib/feedback';
import { color } from '@/theme/tokens';

// Audio mode + warm players before the first tap.
initFeedback();

// Bricolage Grotesque and Figtree have no Cyrillic. In Russian, Onest (made
// for Cyrillic) is loaded under the same family names, so every style keeps
// working unchanged. Chosen at launch; switching to or from Russian applies
// on the next start (LanguagePicker says so).
const FONTS =
  startupLang === 'ru'
    ? {
        BricolageGrotesque_700Bold: Onest_700Bold,
        BricolageGrotesque_800ExtraBold: Onest_800ExtraBold,
        Figtree_400Regular: Onest_400Regular,
        Figtree_500Medium: Onest_500Medium,
        Figtree_600SemiBold: Onest_600SemiBold,
        Figtree_700Bold: Onest_700Bold,
        JetBrainsMono_500Medium,
      }
    : {
        BricolageGrotesque_700Bold,
        BricolageGrotesque_800ExtraBold,
        Figtree_400Regular,
        Figtree_500Medium,
        Figtree_600SemiBold,
        Figtree_700Bold,
        JetBrainsMono_500Medium,
      };

export default function RootLayout() {
  const [loaded] = useFonts(FONTS);

  if (!loaded) return <Blank />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <I18nProvider>
        <FamilyProvider>
          <LibraryProvider>
            <ToastProvider>
              <Routes />
            </ToastProvider>
          </LibraryProvider>
        </FamilyProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

/**
 * First launch → pick a language. Signed out → sign-in. A new family →
 * onboarding. No profile chosen → who's watching. Otherwise → the app.
 */
function Routes() {
  const { ready, session, active, needsInterests, needsOnboarding } = useFamily();
  const { chosen: langChosen } = useT();
  usePresence();
  useParentAlerts(ready && !!session);
  if (!ready) return <Blank />;
  const settled = !!session && !needsOnboarding;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ink } }}>
      <Stack.Protected guard={!langChosen}>
        <Stack.Screen name="language" />
      </Stack.Protected>
      <Stack.Protected guard={langChosen && !session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={langChosen && !!session && needsOnboarding}>
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={langChosen && settled && !active}>
        <Stack.Screen name="who" />
      </Stack.Protected>
      <Stack.Protected guard={!!active && needsInterests}>
        <Stack.Screen name="interests" />
      </Stack.Protected>
      <Stack.Protected guard={!!active && !needsInterests}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="games/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="saved" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="channel" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="following" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="studio" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="upload" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="review" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="review-item" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      {/* Last on purpose: when the current screen stops being allowed, the router
          falls back to the first allowed one in this list. The PIN-locked
          dashboard must never be that fallback. */}
      <Stack.Protected guard={langChosen && settled}>
        <Stack.Screen name="parent" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="parent-child" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="plus" options={{ animation: 'slide_from_right' }} />
        {/* Reachable from Who's watching? and from the parent dashboard inside a profile; the PIN comes first. */}
        <Stack.Screen name="add-child" options={{ animation: 'slide_from_bottom' }} />
      </Stack.Protected>
    </Stack>
  );
}

function Blank() {
  return <View style={{ flex: 1, backgroundColor: color.ink }} />;
}
