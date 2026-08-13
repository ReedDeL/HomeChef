import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MobileViewport } from '@/components/MobileViewport';
import { authRoute, needsRouteReplacement } from '@/lib/auth/app-gate';
import { useAuthSession } from '@/lib/auth/useAuthSession';
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

export default function RootLayout() {
  const { isDark } = useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <MobileViewport>
          <AppGate />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
        </MobileViewport>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/**
 * Keeps signed-out users outside the app, sends a first-run signed-in user
 * through onboarding, and keeps a returning one out of it. Renders nothing —
 * it only redirects.
 *
 * The equipment tier and allergen list are hard constraints the engine cannot
 * do without, so this is a gate rather than a prompt: there is no "skip"
 * through the equipment screen, only through the optional restrictions one.
 */
function AppGate() {
  const router = useRouter();
  const segments = useSegments();
  const onboardingDone = useKitchenStore((state) => state.onboardingDone);
  const hydrated = useStoreHydrated();
  const { isAuthenticated, isLoading } = useAuthSession();

  useEffect(() => {
    // Redirecting before both persisted stores are ready can briefly expose the
    // wrong route and can bounce a returning user through sign-in or onboarding.
    if (!hydrated || isLoading) return;

    const target = authRoute({ isAuthenticated, onboardingDone });
    const currentGroup =
      segments[0] === '(auth)' || segments[0] === '(onboarding)' ? segments[0] : undefined;

    if (needsRouteReplacement(currentGroup, target)) router.replace(target);
  }, [hydrated, isAuthenticated, isLoading, onboardingDone, router, segments]);

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
