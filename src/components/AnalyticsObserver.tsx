import { usePostHog } from 'posthog-react-native';
import { useSegments } from 'expo-router';
import { useEffect, useMemo } from 'react';

import {
  createRouteChangeGuard,
  normalizeRoute,
  setAnalyticsClient,
  trackPageView,
} from '@/lib/analytics';

const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';

export function AnalyticsObserver() {
  const posthog = usePostHog();
  const segments = useSegments();
  const route = normalizeRoute(segments);
  const routeChangeGuard = useMemo(() => createRouteChangeGuard(), []);

  useEffect(() => {
    if (posthogApiKey.length === 0) {
      setAnalyticsClient(null);
      return;
    }

    setAnalyticsClient({
      capture: (event, properties) => posthog.capture(event, properties),
    });

    return () => setAnalyticsClient(null);
  }, [posthog]);

  useEffect(() => {
    if (routeChangeGuard(route)) trackPageView(route);
  }, [route, routeChangeGuard]);

  return null;
}
