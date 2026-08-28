import { weeklyMealPlanSchema, type WeeklyMealPlan } from '@/contracts/meal-journeys';
import { derivePlanLinkedGroceryNeeds } from '@/engine/plan-grocery-needs';
import type { Recipe } from '@/engine/types';

export type PlanDayCount = 3 | 5 | 7;
export type PlanVariety = 'variety' | 'repeats';

export function applyPlanPreferences(
  plan: WeeklyMealPlan,
  days: PlanDayCount,
  variety: PlanVariety,
  recipes: readonly Recipe[],
  pantry: ReadonlySet<string>
): WeeklyMealPlan {
  const firstRecipe = plan.entries.find((entry) => entry.kind === 'recipe');
  const repeatRecipe =
    firstRecipe?.kind === 'recipe'
      ? recipes.find((recipe) => recipe.id === firstRecipe.recipeId)
      : undefined;
  const entries = plan.entries.map((entry, index) => {
    if (index >= days) {
      return {
        kind: 'day_of_decision' as const,
        date: entry.date,
        reason: 'not_planned' as const,
      };
    }
    if (variety === 'repeats' && entry.kind === 'recipe' && repeatRecipe) {
      return { ...entry, recipeId: repeatRecipe.id };
    }
    return entry;
  });
  const groceryEntries = entries.flatMap((entry) => {
    if (entry.kind !== 'recipe') return [];
    const recipe = recipes.find((candidate) => candidate.id === entry.recipeId);
    return recipe ? [{ date: entry.date, recipe }] : [];
  });
  return weeklyMealPlanSchema.parse({
    ...plan,
    entries,
    groceryNeeds: derivePlanLinkedGroceryNeeds(groceryEntries, pantry, 12),
  });
}
