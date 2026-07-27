import type {
  CandidateRecipe,
  RecommendationBucket,
  RecommendationFilters,
  RecommendationResult,
  ScoredRecipe,
} from '@/features/recommendation/types';

const DEFAULT_BUCKET_CAP = 3;

/**
 * The core "decision engine" — filters the catalog down to what's cookable
 * right now, scores by pantry match, and sorts into four buckets. We show a
 * small number of strong options, not everything that matches.
 */
export function computeRecommendations(
  recipes: CandidateRecipe[],
  filters: RecommendationFilters
): RecommendationResult {
  const bucketCap = filters.bucketCap ?? DEFAULT_BUCKET_CAP;

  const scored = recipes
    .filter((r) => !filters.dislikedRecipeIds.has(r.id))
    .filter((r) => hasOwnedEquipment(r, filters.ownedEquipment))
    .filter((r) => !containsAllergen(r, filters.allergies))
    .filter((r) => satisfiesDietaryPreferences(r, filters.dietaryPreferences))
    .filter((r) => withinTimeBudget(r, filters.maxTimeMinutes))
    .map((r) => scoreRecipe(r, filters.pantryIngredientNames))
    // "Every recommendation must use at least some ingredients already in inventory."
    .filter((r) => r.matchedIngredientCount > 0);

  const result: RecommendationResult = {
    allIngredients: [],
    most: [],
    some: [],
    requiresGroceryList: [],
  };

  for (const recipe of scored) {
    result[bucketFor(recipe.matchPercent)].push(recipe);
  }

  for (const bucket of Object.keys(result) as RecommendationBucket[]) {
    result[bucket] = result[bucket]
      .sort((a, b) => b.matchedIngredientCount - a.matchedIngredientCount)
      .slice(0, bucketCap);
  }

  return result;
}

function scoreRecipe(recipe: CandidateRecipe, pantry: Set<string>): ScoredRecipe {
  const missing = recipe.ingredients.filter((name) => !pantry.has(name));
  const matched = recipe.ingredients.length - missing.length;
  return {
    ...recipe,
    matchedIngredientCount: matched,
    totalIngredientCount: recipe.ingredients.length,
    matchPercent: recipe.ingredients.length === 0 ? 0 : matched / recipe.ingredients.length,
    missingIngredients: missing,
  };
}

function bucketFor(matchPercent: number): RecommendationBucket {
  if (matchPercent >= 1) return 'allIngredients';
  if (matchPercent >= 0.75) return 'most';
  if (matchPercent >= 0.4) return 'some';
  return 'requiresGroceryList';
}

function hasOwnedEquipment(recipe: CandidateRecipe, owned: Set<string>): boolean {
  return recipe.requiredEquipment.every((tag) => owned.has(tag));
}

function containsAllergen(recipe: CandidateRecipe, allergies: string[]): boolean {
  if (allergies.length === 0) return false;
  const lowerAllergies = allergies.map((a) => a.toLowerCase());
  return recipe.ingredients.some((ingredient) =>
    lowerAllergies.some((allergy) => ingredient.includes(allergy))
  );
}

function satisfiesDietaryPreferences(
  recipe: CandidateRecipe,
  preferences: RecommendationFilters['dietaryPreferences']
): boolean {
  if (preferences.length === 0) return true;
  return preferences.every((pref) => recipe.dietaryTags.includes(pref));
}

function withinTimeBudget(recipe: CandidateRecipe, maxTimeMinutes: number | null | undefined): boolean {
  if (!maxTimeMinutes) return true;
  if (recipe.cookTimeMinutes == null) return false;
  return recipe.cookTimeMinutes <= maxTimeMinutes;
}
