import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getDb } from '@/db/client';
import { getPantryItems } from '@/db/inventory';
import { getRecipeById } from '@/db/recipes';
import { getSavedMeals, unsaveMeal, type SavedMealRow } from '@/db/savedMeals';

export interface SavedMeal extends SavedMealRow {
  name: string;
  missingIngredients: string[];
}

export function useSavedMeals() {
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const [rows, pantryItems] = await Promise.all([getSavedMeals(db), getPantryItems(db)]);
    const pantryNames = new Set(pantryItems.map((item) => item.ingredient_name));

    const withDetail = await Promise.all(
      rows.map(async (row) => {
        const recipe = await getRecipeById(db, row.recipe_id);
        const missingIngredients =
          recipe?.ingredients
            .map((i) => i.ingredient_name)
            .filter((name) => !pantryNames.has(name)) ?? [];
        return { ...row, name: recipe?.name ?? 'Unknown recipe', missingIngredients };
      })
    );
    setMeals(withDetail);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().finally(() => setLoading(false));
    }, [refresh])
  );

  const removeSavedMeal = useCallback(
    async (recipeId: string) => {
      const db = await getDb();
      await unsaveMeal(db, recipeId);
      await refresh();
    },
    [refresh]
  );

  return { meals, loading, removeSavedMeal, refresh };
}
