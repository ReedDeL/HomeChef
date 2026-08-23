import { usePostHog } from 'posthog-react-native';
import { useEffect } from 'react';

import {
  identifyAuthenticatedUser,
  resetAnalyticsIdentity,
  setAnalyticsClient,
} from '@/lib/analytics';

export function AnalyticsObserver() {
  const posthog = usePostHog();

  useEffect(() => {
    setAnalyticsClient({
      capture: (event, properties) => posthog.capture(event, properties),
      identify: (userId) => posthog.identify(userId),
      reset: () => posthog.reset(),
    });

    return () => setAnalyticsClient(null);
  }, [posthog]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const observeAuth = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        if (!active) return;

        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (session?.user.id) {
            identifyAuthenticatedUser(session.user.id);
            return;
          }

          if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
            resetAnalyticsIdentity();
          }
        });

        if (!active) {
          data.subscription.unsubscribe();
          return;
        }

        unsubscribe = () => data.subscription.unsubscribe();
      } catch {
        // Analytics identity must not turn missing auth configuration into an app failure.
      }
    };

    void observeAuth();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return null;
}
