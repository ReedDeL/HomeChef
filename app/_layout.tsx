import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PostHogProvider } from 'posthog-react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnalyticsObserver } from '@/components/AnalyticsObserver';
import { MobileViewport } from '@/components/MobileViewport';
import { useKitchenStore } from '@/store/kitchen';
import { useTheme } from '@/theme/useTheme';

/**
 * Created once at module scope. A client built inside the component would be
 * discarded on every re-render, taking the cache with it.
 *
 * Nothing queries the network yet — the catalog is bundled and the engine is
 * synchronous — but the provider is here so that wiring `src/hooks/` up to
 * Supabase later is a change at the call site rather than a change to the app
 * shell.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

export default function RootLayout() {
  const { isDark } = useTheme();

  return (
    <PostHogProvider
      apiKey={posthogApiKey}
      options={{ host: posthogHost, disabled: posthogApiKey.length === 0 }}
      autocapture={false}
    >
      <AnalyticsObserver />
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <MobileViewport>
            <OnboardingGate />
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
          </MobileViewport>
        </SafeAreaProvider>
      </QueryClientProvider>
    </PostHogProvider>
  );
}

/**
 * Sends a first-run user through onboarding, and keeps a returning one out of
 * it. Renders nothing — it only redirects.
 *
 * The equipment tier and allergen list are hard constraints the engine cannot
 * do without, so this is a gate rather than a prompt: there is no "skip"
 * through the equipment screen, only through the optional restrictions one.
 */
function OnboardingGate() {
  const router = useRouter();
  const segments = useSegments();
  const onboardingDone = useKitchenStore((state) => state.onboardingDone);
  const hydrated = useStoreHydrated();

  useEffect(() => {
    // Redirecting before the persisted state is read would bounce a returning
    // user back through onboarding on every cold start.
    if (!hydrated) return;

    // `/scan` and `/settings` are reachable before onboarding completes.
    // They live outside the `(onboarding)` group, so without this the gate would
    // treat them as unauthorized and bounce the user back to the equipment screen.
    const inOnboarding =
      segments[0] === '(onboarding)' || segments[0] === 'scan' || segments[0] === 'settings';

    if (!onboardingDone && !inOnboarding) {
      router.replace('/(onboarding)/equipment');
    } else if (onboardingDone && segments[0] === '(onboarding)') {
      router.replace('/');
    }
  }, [hydrated, onboardingDone, segments, router]);

  return null;
}

/**
 * Both storage backends are synchronous, so hydration completes almost
 * immediately — but `persist` still resolves it through a promise, and acting
 * one render too early is what makes a gate flicker.
 */
function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useKitchenStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useKitchenStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useKitchenStore.persist.hasHydrated());
    return unsubscribe;
  }, []);

  return hydrated;
}
