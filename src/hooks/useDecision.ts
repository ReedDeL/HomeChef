import { useMemo } from 'react';
import { decideWithRelaxation } from '@/engine/relax';
import type { Minutes, Recipe } from '@/engine/types';
import { toPantrySet, toUserPreferences } from '@/lib/adapters/from-database';
import { useFeedback, useInventory, usePreferences, useProfile } from '@/hooks/useHomeChefData';
import type { RelaxedDecision } from '@/engine/relax';

export interface UseDecisionResult {
  decision: RelaxedDecision | null;
  isLoading: boolean;
  householdId: string | undefined;
}

/**
 * The seam between the database and the decision engine.
 *
 * Everything asynchronous has already happened by the time `decide` is called:
 * the adapters convert rows into plain engine types, and the engine runs
 * synchronously inside a `useMemo`. That is what keeps the whole engine test
 * suite runnable with no device, no network, and no Supabase project.
 *
 * `catalog` is passed in rather than fetched here so this hook stays agnostic
 * about tiers -- Tier 1 bundled JSON and a Tier 2 merge look identical from
 * inside.
 */
export function useDecision(
  userId: string | undefined,
  catalog: readonly Recipe[],
  timeLimit: Minutes,
  preferredCuisine: string | null = null
): UseDecisionResult {
  const profile = useProfile(userId);
  const householdId = profile.data?.household_id;

  const inventory = useInventory(householdId);
  const preferences = usePreferences(userId);
  const feedback = useFeedback(userId);

  const isLoading =
    profile.isLoading || inventory.isLoading || preferences.isLoading || feedback.isLoading;

  const decision = useMemo(() => {
    if (isLoading || !preferences.data) return null;

    const pantry = toPantrySet(inventory.data ?? []);
    const prefs = {
      ...toUserPreferences(preferences.data, feedback.data ?? []),
      preferredCuisine,
    };

    return decideWithRelaxation(catalog, pantry, prefs, timeLimit);
  }, [
    isLoading,
    inventory.data,
    preferences.data,
    feedback.data,
    catalog,
    timeLimit,
    preferredCuisine,
  ]);

  return { decision, isLoading, householdId };
}
