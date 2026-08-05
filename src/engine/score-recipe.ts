import { bucketFor } from '@/engine/bucket';
import type { IngredientId, Minutes, Recipe, ScoredRecipe, UserPreferences } from '@/engine/types';

/**
 * Scoring weights.
 *
 * The spec declares `ScoredRecipe.score` but never defines its terms
 * (docs/01_TECHNICAL_SPEC.md:419), and the AI playbook says to write this by
 * hand. These weights are reasoned, not fitted — revisit after the Aug 18-22
 * user-testing round.
 *
 * Bucketing is by missing count, so score only orders recipes WITHIN a bucket.
 *
 * Coverage dominates because it is the user's actual question. The skip penalty
 * outweighs a marginal coverage gain because an explicit skip is the only
 * negative signal the user volunteers; a disliked recipe never reaches scoring
 * at all, since `decide` eliminates it outright.
 */
export const WEIGHTS = {
  coverage: 0.6,
  timeFit: 0.25,
  cuisineMatch: 0.15,
  skipPenalty: 0.3,
} as const;

export function scoreRecipe(
  recipe: Recipe,
  pantry: ReadonlySet<IngredientId>,
  prefs: UserPreferences,
  timeLimit: Minutes
): ScoredRecipe {
  const missing = recipe.ingredients.filter((ing) => !pantry.has(ing.id)).map((ing) => ing.id);

  const total = recipe.ingredients.length;
  const coverage = total === 0 ? 0 : (total - missing.length) / total;

  // Clamped so a recipe surfaced by time relaxation cannot drive the score
  // arbitrarily negative.
  const timeFit = timeLimit <= 0 ? 0 : clamp01(1 - recipe.totalTimeMinutes / timeLimit);

  const cuisineMatch =
    prefs.preferredCuisine !== null && recipe.cuisine === prefs.preferredCuisine ? 1 : 0;

  const skipped = prefs.skippedRecipeIds.has(recipe.id) ? 1 : 0;

  const score =
    WEIGHTS.coverage * coverage +
    WEIGHTS.timeFit * timeFit +
    WEIGHTS.cuisineMatch * cuisineMatch -
    WEIGHTS.skipPenalty * skipped;

  return { recipe, missing, bucket: bucketFor(missing.length), score };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
