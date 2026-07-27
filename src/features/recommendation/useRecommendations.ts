import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getDb } from '@/db/client';
import { getPantryItems } from '@/db/inventory';
import { getAllRecipesWithIngredients, type RecipeRow } from '@/db/recipes';
import { getDislikedRecipeIds } from '@/db/savedMeals';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { computeRecommendations } from '@/features/recommendation/engine';
import type { CandidateRecipe, RecommendationResult } from '@/features/recommendation/types';
import type { DietaryTag, Equipment } from '@/data/types';

function toCandidateRecipe(recipe: RecipeRow, ingredients: string[]): CandidateRecipe {
  return {
    id: recipe.id,
    name: recipe.name,
    cookTimeMinutes: recipe.cook_time_minutes,
    requiredEquipment: JSON.parse(recipe.required_equipment) as Equipment[],
    dietaryTags: JSON.parse(recipe.dietary_tags) as DietaryTag[],
    imageUrl: recipe.image_url,
    ingredients,
  };
}

/** The "what can I make right now" screen's data source — pantry + profile in, four buckets out. */
export function useRecommendations() {
  const { profile } = useOnboarding();
  const [candidates, setCandidates] = useState<CandidateRecipe[]>([]);
  const [pantryNames, setPantryNames] = useState<Set<string>>(new Set());
  const [dislikedIds, setDislikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [maxTimeMinutes, setMaxTimeMinutes] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const [rows, pantryItems, disliked] = await Promise.all([
      getAllRecipesWithIngredients(db),
      getPantryItems(db),
      getDislikedRecipeIds(db),
    ]);

    setCandidates(rows.map(({ recipe, ingredients }) => toCandidateRecipe(recipe, ingredients)));
    setPantryNames(new Set(pantryItems.map((item) => item.ingredient_name)));
    setDislikedIds(disliked);
  }, []);

  // Refetch on focus so a pantry change on another tab shows up here immediately.
  useFocusEffect(
    useCallback(() => {
      refresh().finally(() => setLoading(false));
    }, [refresh])
  );

  const recommendations: RecommendationResult = useMemo(
    () =>
      computeRecommendations(candidates, {
        pantryIngredientNames: pantryNames,
        ownedEquipment: new Set(profile.equipment),
        allergies: profile.allergies,
        dietaryPreferences: profile.dietaryPreferences,
        dislikedRecipeIds: dislikedIds,
        maxTimeMinutes,
      }),
    [candidates, pantryNames, profile.equipment, profile.allergies, profile.dietaryPreferences, dislikedIds, maxTimeMinutes]
  );

  return { recommendations, loading, refresh, maxTimeMinutes, setMaxTimeMinutes };
}
