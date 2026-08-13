import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MobileViewport } from '@/components/MobileViewport';
import { appGatePhase, authRoute } from '@/lib/auth/app-gate';
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
        </MobileViewport>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/**
 * Keeps signed-out users outside the app, sends a first-run signed-in user
 * through onboarding, and keeps a returning one out of it. Until both stores
 * hydrate, its navigator exposes only a blank route; after that, only the
 * destination group can mount while an explicit replacement finishes.
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
  const target = authRoute({ isAuthenticated, onboardingDone });
  const currentGroup =
    segments[0] === '(auth)' || segments[0] === '(onboarding)' || segments[0] === 'loading'
      ? segments[0]
      : undefined;
  const phase = appGatePhase(hydrated, isLoading, currentGroup, target);

  useEffect(() => {
    if (phase === 'redirecting') router.replace(target);
  }, [phase, router, target]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Protected guard={phase === 'loading'}>
        <Stack.Screen name="loading" />
      </Stack.Protected>

      <Stack.Protected guard={phase !== 'loading' && target === '/(auth)/sign-in'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={phase !== 'loading' && target === '/(onboarding)/equipment'}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={phase !== 'loading' && target === '/'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cook" />
        <Stack.Screen name="recipe" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="settings" />
      </Stack.Protected>
    </Stack>
  );
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
