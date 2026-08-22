import { BUCKET_CAP, BUCKET_ORDER } from '@/engine/bucket';
import { isRecipeHardConstraintSatisfied } from '@/engine/filter-hard';
import { scoreRecipe } from '@/engine/score-recipe';
import type {
  Bucket,
  DecisionResult,
  IngredientId,
  Minutes,
  Recipe,
  ScoredRecipe,
  UserPreferences,
} from '@/engine/types';

/**
 * The decision engine.
 *
 * Pure and synchronous over plain data. It takes a `Recipe[]` and does not know
 * or care whether offline or hosted catalog data supplied it. This keeps the
 * whole suite fast and independent of device or network state.
 *
 * Hard constraints eliminate; soft constraints rank.
 */
export function decide(
  catalog: readonly Recipe[],
  pantry: ReadonlySet<IngredientId>,
  prefs: UserPreferences,
  timeLimit: Minutes
): DecisionResult {
  const survivors = catalog.filter(
    (r) =>
      !prefs.dislikedRecipeIds.has(r.id) &&
      isRecipeHardConstraintSatisfied(r, prefs) &&
      r.totalTimeMinutes <= timeLimit &&
      (prefs.preferredCuisine === null || r.cuisine === prefs.preferredCuisine)
  );

  const buckets = emptyBuckets();
  for (const recipe of survivors) {
    const scored = scoreRecipe(recipe, pantry, prefs, timeLimit);
    buckets[scored.bucket].push(scored);
  }

  for (const bucket of BUCKET_ORDER) {
    buckets[bucket] = buckets[bucket].sort(byScoreThenId).slice(0, BUCKET_CAP);
  }

  return { buckets, appliedRelaxations: [] };
}

export function emptyBuckets(): Record<Bucket, ScoredRecipe[]> {
  return { ready: [], missing_few: [], missing_some: [], grocery_run: [] };
}

/** Ties break on id so the list does not reshuffle between renders. */
function byScoreThenId(a: ScoredRecipe, b: ScoredRecipe): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.recipe.id < b.recipe.id ? -1 : a.recipe.id > b.recipe.id ? 1 : 0;
}
