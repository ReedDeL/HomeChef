import { decide } from '@/engine/decide';
import type {
  DecisionResult,
  IngredientId,
  Minutes,
  Recipe,
  Relaxation,
  UserPreferences,
} from '@/engine/types';

/** The time tiers offered on the home screen. Widening moves up one at a time. */
export const TIME_TIERS: readonly Minutes[] = [15, 30, 60, 120];

/** Below this many fully-ready recipes, soft recovery keeps searching. */
export const TARGET_READY_COUNT = 3;

export type RelaxedDecision = DecisionResult;

/**
 * Relaxation is a first-class code path with its own tests, not an error
 * handler (docs/01_TECHNICAL_SPEC.md:470). Order is fixed and deliberate —
 * cheapest concession first:
 *
 *   1. Expand the time limit by one tier.
 *   2. Drop the cuisine preference.
 *   3. Surface `missing_few` as the primary result.
 *   4. Widen to `missing_some`.
 *
 * Equipment, allergens, and dietary restrictions are never relaxed.
 *
 * Every concession is reported so the UI can state it out loud. Silent filter
 * changes are how an app teaches a user not to trust it.
 */
export function decideWithRelaxation(
  catalog: readonly Recipe[],
  pantry: ReadonlySet<IngredientId>,
  prefs: UserPreferences,
  timeLimit: Minutes
): RelaxedDecision {
  const base = decide(catalog, pantry, prefs, timeLimit);
  if (base.buckets.ready.length >= TARGET_READY_COUNT) {
    return base;
  }

  const chosen = findFirstNonEmpty(catalog, pantry, prefs, timeLimit) ?? {
    result: base,
    timeLimit,
    cuisineDropped: false,
  };

  const appliedRelaxations: Relaxation[] = [];

  // Rung 1 before rung 2: the order is part of the contract, so it is built
  // here rather than discovered by the search.
  if (chosen.timeLimit !== timeLimit) {
    appliedRelaxations.push({ kind: 'time_widened', from: timeLimit, to: chosen.timeLimit });
  }
  if (chosen.cuisineDropped && prefs.preferredCuisine !== null) {
    appliedRelaxations.push({ kind: 'cuisine_dropped', cuisine: prefs.preferredCuisine });
  }

  // Rungs 4 and 5: when nothing is fully ready, the next-best bucket becomes
  // the headline result instead of a secondary list.
  const { buckets } = chosen.result;
  if (buckets.ready.length === 0) {
    if (buckets.missing_few.length > 0) {
      appliedRelaxations.push({ kind: 'bucket_promoted', bucket: 'missing_few' });
    } else if (buckets.missing_some.length > 0) {
      appliedRelaxations.push({ kind: 'bucket_promoted', bucket: 'missing_some' });
    }
  }

  return { buckets, appliedRelaxations };
}

interface Candidate {
  result: DecisionResult;
  timeLimit: Minutes;
  cuisineDropped: boolean;
}

/**
 * Walks the concession space in spec order and returns the first combination
 * that yields any result at all. Searching for the *minimal* concession rather
 * than accumulating every attempted rung is what keeps the UI banner honest:
 * we report widening to 30 minutes, not to 120, when 30 is what worked.
 */
function findFirstNonEmpty(
  catalog: readonly Recipe[],
  pantry: ReadonlySet<IngredientId>,
  prefs: UserPreferences,
  timeLimit: Minutes
): Candidate | null {
  const tiers = [timeLimit, ...TIME_TIERS.filter((t) => t > timeLimit)];
  const cuisineOptions = prefs.preferredCuisine === null ? [false] : [false, true];

  for (const cuisineDropped of cuisineOptions) {
    const effectivePrefs = cuisineDropped ? { ...prefs, preferredCuisine: null } : prefs;

    for (const tier of tiers) {
      const result = decide(catalog, pantry, effectivePrefs, tier);
      if (isNonEmpty(result)) {
        return { result, timeLimit: tier, cuisineDropped };
      }
    }
  }

  return null;
}

function isNonEmpty(result: DecisionResult): boolean {
  return Object.values(result.buckets).some((b) => b.length > 0);
}
