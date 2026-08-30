import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PostHogProvider } from 'posthog-react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnalyticsObserver } from '@/components/AnalyticsObserver';
import { MobileViewport } from '@/components/MobileViewport';
import { isAnalyticsConfigured, isApprovedAnalyticsEvent } from '@/lib/analytics';
import {
  appGatePhase,
  authRoute,
  ROOT_ROUTE_NAMES,
  rootRouteIsAvailable,
} from '@/lib/auth/app-gate';
import { configureMealPrepNotifications } from '@/lib/meal-prep-notifications';
import { useKitchenStore } from '@/store/kitchen';
import { useTheme } from '@/theme/useTheme';

/**
 * Created once at module scope. A client built inside the component would be
 * discarded on every re-render, taking the cache with it.
 *
 * Nothing queries the network yet — the catalog is bundled and the engine is
 * synchronous — but the provider is here so that wiring query hooks up to
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

const posthogOptions = {
  host: posthogHost,
  captureAppLifecycleEvents: false,
  enableSessionReplay: false,
  preloadFeatureFlags: false,
  disableRemoteFeatureFlags: true,
  disableGeoip: true,
  errorTracking: { autocapture: false },
  before_send: (event: { event: string } | null) => {
    if (!event) return null;
    return event.event === '$identify' || isApprovedAnalyticsEvent(event.event) ? event : null;
  },
};

export default function RootLayout() {
  const { isDark } = useTheme();

  useEffect(() => {
    configureMealPrepNotifications().catch((error: unknown) => {
      console.warn('[notifications] Unable to configure', error);
    });
  }, []);

  return (
    <AnalyticsProvider>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <MobileViewport>
            <AppGate />
          </MobileViewport>
        </SafeAreaProvider>
      </QueryClientProvider>
    </AnalyticsProvider>
  );
}

function AnalyticsProvider({ children }: { children: ReactNode }) {
  if (!isAnalyticsConfigured(posthogApiKey)) return children;

  return (
    <PostHogProvider apiKey={posthogApiKey} options={posthogOptions} autocapture={false}>
      <AnalyticsObserver />
      {children}
    </PostHogProvider>
  );
}

/**
 * Sends a first-run local user through onboarding and keeps a returning one
 * out of it. Until the local store hydrates, its navigator exposes only a
 * blank route; after that, only the destination group can mount while an
 * explicit replacement finishes. Account and sync controls live in Settings.
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
  const target = authRoute({ onboardingDone });
  const currentSegment = segments[0];
  const phase = appGatePhase(hydrated, currentSegment, target);

  useEffect(() => {
    if (phase === 'redirecting') router.replace(target);
  }, [phase, router, target]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      {ROOT_ROUTE_NAMES.map((routeName) => (
        <Stack.Protected key={routeName} guard={rootRouteIsAvailable(routeName, phase, target)}>
          <Stack.Screen name={routeName} />
        </Stack.Protected>
      ))}
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
