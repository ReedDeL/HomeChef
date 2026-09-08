import { weeklyMealPlanSchema, type WeeklyMealPlan } from '@/contracts/meal-journeys';
import { derivePlanLinkedGroceryNeeds } from '@/engine/plan-grocery-needs';
import type { Recipe } from '@/engine/types';
export type PlanDayCount = 3 | 5 | 7;
export type PlanVariety = 'variety' | 'repeats';

/** Trimming never substitutes recipes; variety belongs inside candidate selection. */
export function applyPlanPreferences(
  plan: WeeklyMealPlan,
  days: PlanDayCount,
  _variety: PlanVariety,
  recipes: readonly Recipe[],
  pantry: ReadonlySet<string>
): WeeklyMealPlan {
  const dates = [...new Set(plan.entries.map((entry) => entry.date))].slice(0, days);
  const entries = plan.entries.filter((entry) => dates.includes(entry.date));
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const groceries = entries.flatMap((entry) => {
    const recipe = entry.kind === 'recipe' ? byId.get(entry.recipeId) : undefined;
    return recipe ? [{ date: entry.date, recipe }] : [];
  });
  return weeklyMealPlanSchema.parse({
    ...plan,
    dayCount: days,
    entries,
    statedRelaxations: (['time', 'cuisine'] as const).filter((value) =>
      entries.some((entry) => entry.kind === 'recipe' && entry.statedRelaxations.includes(value))
    ),
    groceryNeeds: derivePlanLinkedGroceryNeeds(groceries, pantry, 12),
  });
}
