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

import { FamilyProvider, useFamily } from '@/features/family/FamilyProvider';
import { color } from '@/theme/tokens';

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
        <Routes />
      </FamilyProvider>
    </SafeAreaProvider>
  );
}

/** Signed out → sign-in. Signed in, no profile chosen → who's watching. Otherwise → the app. */
function Routes() {
  const { ready, session, active, needsInterests } = useFamily();
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
      <Stack.Protected guard={!!active && needsInterests}>
        <Stack.Screen name="interests" />
      </Stack.Protected>
      <Stack.Protected guard={!!active && !needsInterests}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="games/bubbles" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="games/memory" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  );
}

function Blank() {
  return <View style={{ flex: 1, backgroundColor: color.ink }} />;
}
