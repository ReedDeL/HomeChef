import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { resolveSafeBackDestination } from '@/lib/safe-back';
import { useKitchenStore } from '@/store/kitchen';

export { resolveSafeBackDestination } from '@/lib/safe-back';

/**
 * Safe back navigation hook preventing users from getting stuck on deep links,
 * page reloads, or empty navigation stacks.
 */
export function useSafeBack(fallbackHref?: string): () => void {
  const router = useRouter();
  const onboardingDone = useKitchenStore((state) => state.onboardingDone);

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      const target = resolveSafeBackDestination(fallbackHref, onboardingDone);
      router.replace(target as Parameters<typeof router.replace>[0]);
    }
  }, [router, fallbackHref, onboardingDone]);
}
