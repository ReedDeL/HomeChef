import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/keys';
import { fetchInventory } from '@/lib/queries/inventory';
import { fetchFeedback, fetchPreferences, fetchProfile } from '@/lib/queries/preferences';

/**
 * Server state lives in TanStack Query, never in `useState`. Five screens
 * reading the same pantry should share one cache entry, not five independent
 * refetches on focus.
 */

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profile(userId ?? 'anonymous'),
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
  });
}

export function useInventory(householdId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.inventory(householdId ?? 'none'),
    queryFn: () => fetchInventory(householdId as string),
    enabled: Boolean(householdId),
  });
}

export function usePreferences(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.preferences(userId ?? 'anonymous'),
    queryFn: () => fetchPreferences(userId as string),
    enabled: Boolean(userId),
  });
}

export function useFeedback(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.feedback(userId ?? 'anonymous'),
    queryFn: () => fetchFeedback(userId as string),
    enabled: Boolean(userId),
  });
}
