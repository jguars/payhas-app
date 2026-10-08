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
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/Toast';
import { FamilyProvider, useFamily } from '@/features/family/FamilyProvider';
import { usePresence } from '@/features/family/usePresence';
import { LibraryProvider } from '@/features/library/LibraryProvider';
import { initFeedback } from '@/lib/feedback';
import { color } from '@/theme/tokens';

// Audio mode + warm players before the first tap.
initFeedback();

export default function RootLayout() {
  const [loaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    JetBrainsMono_500Medium,
  });

  if (!loaded) return <Blank />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <FamilyProvider>
        <LibraryProvider>
          <ToastProvider>
            <Routes />
          </ToastProvider>
        </LibraryProvider>
      </FamilyProvider>
    </SafeAreaProvider>
  );
}

/** Signed out → sign-in. Signed in, no profile chosen → who's watching. Otherwise → the app. */
function Routes() {
  const { ready, session, active, needsInterests } = useFamily();
  usePresence();
  if (!ready) return <Blank />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ink } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !active}>
        <Stack.Screen name="who" />
        <Stack.Screen name="add-profile" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="parent" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!active && needsInterests}>
        <Stack.Screen name="interests" />
      </Stack.Protected>
      <Stack.Protected guard={!!active && !needsInterests}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="games/bubbles" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="games/memory" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="saved" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="following" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="studio" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="upload" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="review" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="review-item" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
    </Stack>
  );
}

function Blank() {
  return <View style={{ flex: 1, backgroundColor: color.ink }} />;
}
