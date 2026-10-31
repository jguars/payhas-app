import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import {
  Onest_500Medium,
  Onest_600SemiBold,
  Onest_700Bold,
  Onest_800ExtraBold,
} from "@expo-google-fonts/onest";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/Toast";
import { FamilyProvider, useFamily } from "@/features/family/FamilyProvider";
import { usePresence } from "@/features/family/usePresence";
import { I18nProvider, startupLang, useT } from "@/i18n";
import { JoinRequestsProvider } from "@/features/parent/joinRequests";
import { useParentAlerts } from "@/features/parent/push";
import { LibraryProvider } from "@/features/library/LibraryProvider";
import { Splash } from "@/features/start/Splash";
import { initFeedback } from "@/lib/feedback";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { color, pageFill } from "@/theme/tokens";

// Audio mode + warm players before the first tap.
initFeedback();

// Bricolage Grotesque and Figtree have no Cyrillic. In Russian, Onest (made
// for Cyrillic) is loaded under the same family names, so every style keeps
// working unchanged. Chosen at launch; switching to or from Russian applies
// on the next start (LanguagePicker says so).
const FONTS =
  startupLang === "ru"
    ? {
        BricolageGrotesque_700Bold: Onest_700Bold,
        BricolageGrotesque_800ExtraBold: Onest_800ExtraBold,
        Figtree_500Medium: Onest_500Medium,
        Figtree_600SemiBold: Onest_600SemiBold,
        Figtree_700Bold: Onest_700Bold,
        JetBrainsMono_500Medium,
      }
    : {
        BricolageGrotesque_700Bold,
        BricolageGrotesque_800ExtraBold,
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
      <ThemeProvider>
        <I18nProvider>
          <FamilyProvider>
            <LibraryProvider>
              <ToastProvider>
                <Routes />
              </ToastProvider>
            </LibraryProvider>
          </FamilyProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** How long the splash holds on first launch. */
const SPLASH_MS = 1200;

/**
 * First launch → splash, Welcome, then the language. Signed out → sign-in. A new family →
 * onboarding. No profile chosen → who's watching. Otherwise → the app.
 */
function Routes() {
  const { ready, session, active, needsInterests, needsOnboarding, device } =
    useFamily();
  const { chosen: langChosen } = useT();
  usePresence();
  useParentAlerts(ready && !!session);
  // On a new phone the splash stays a moment, so the brand is seen before Welcome.
  const [holding, setHolding] = useState(!langChosen);
  useEffect(() => {
    if (!holding) return;
    const id = setTimeout(() => setHolding(false), SPLASH_MS);
    return () => clearTimeout(id);
  }, [holding]);
  if (!ready || holding) return <Splash />;
  // A linked phone the parent hasn't allowed yet waits on the join screen.
  const waiting = device?.status === "pending";
  const settled = !!session && !needsOnboarding && !waiting;

  return (
    // A child's phone asking to join comes up on the parent's phone over whatever screen is open.
    <JoinRequestsProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.bg },
        }}
      >
        <Stack.Protected guard={!langChosen}>
          <Stack.Screen name="welcome" options={{ animation: "fade" }} />
          <Stack.Screen
            name="language"
            options={{ animation: "slide_from_right" }}
          />
        </Stack.Protected>
        <Stack.Protected guard={langChosen && !session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        {/* Another member's own phone: join with the parent's code, then wait for Allow. */}
        <Stack.Protected guard={langChosen && (!session || waiting)}>
          <Stack.Screen
            name="join"
            options={{ animation: "slide_from_right" }}
          />
        </Stack.Protected>
        <Stack.Protected
          guard={langChosen && !!session && needsOnboarding && !waiting}
        >
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
          <Stack.Screen
            name="delete-me"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="games/[id]"
            options={{ animation: "fade", gestureEnabled: false }}
          />
          <Stack.Screen
            name="saved"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="channel"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="following"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="inbox"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="paywall"
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="studio"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="upload"
            options={{ animation: "slide_from_bottom", gestureEnabled: false }}
          />
          <Stack.Screen
            name="review"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="review-item"
            options={{ animation: "slide_from_right" }}
          />
        </Stack.Protected>
        {/* Last on purpose: when the current screen stops being allowed, the router
          falls back to the first allowed one in this list. The PIN-locked
          dashboard must never be that fallback. */}
        <Stack.Protected guard={langChosen && settled}>
          <Stack.Screen
            name="parent"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="parent-child"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="parent-settings"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="link-phone"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="plus"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="profile-edit"
            options={{ animation: "slide_from_right" }}
          />
          {/* Reachable from Who's watching? and from the parent dashboard inside a profile; the PIN comes first. */}
          <Stack.Screen
            name="add-child"
            options={{ animation: "slide_from_bottom" }}
          />
        </Stack.Protected>
        {/* Component gallery for design QA (docs/UI_UX_WORKFLOW.md, step 4.4). Not linked anywhere. */}
        <Stack.Screen name="gallery" />
      </Stack>
    </JoinRequestsProvider>
  );
}

function Blank() {
  return <View style={{ flex: 1, ...pageFill() }} />;
}
