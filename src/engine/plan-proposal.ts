import type { BodyGoal, BodyProfile, WeeklyMealPlan } from '@/contracts/meal-journeys';
import {
  applyPlanPreferences,
  type PlanDayCount,
  type PlanVariety,
} from '@/engine/plan-preferences';
import { planWeek, type RecipeTasteSignal } from '@/engine/plan-week';
import type { PortionBodyMetrics } from '@/engine/portion-guidance';
import type { DailyPlanPreference, IngredientId, Recipe, UserPreferences } from '@/engine/types';

export type PlanPrepStyle = 'quick' | 'batch' | 'balanced';

export interface CreatePlanProposalInput {
  recipes: readonly Recipe[];
  pantry: ReadonlySet<IngredientId>;
  preferences: UserPreferences;
  days: PlanDayCount;
  weekDays: readonly DailyPlanPreference[];
  prepStyle: PlanPrepStyle;
  variety: PlanVariety;
  tasteSignals: readonly RecipeTasteSignal[];
  bodyProfile: BodyProfile | null;
  bodyMetrics?: PortionBodyMetrics | null;
  bodyGoal: BodyGoal | null;
}

export function createPlanProposal(input: CreatePlanProposalInput): WeeklyMealPlan {
  const draft = planWeek({
    recipes: input.recipes,
    pantry: input.pantry,
    preferences: input.preferences,
    days: input.weekDays,
    tasteSignals: input.tasteSignals,
    portionInput: {
      bodyProfile: input.bodyProfile,
      bodyMetrics: input.bodyMetrics,
      bodyGoal: input.bodyGoal,
      satietyLevel: null,
    },
  });

  return applyPlanPreferences(draft, input.days, input.variety, input.recipes, input.pantry);
}

const PREP_STYLE_SUMMARIES: Record<PlanPrepStyle, string> = {
  quick: 'Mostly quick: meals stay within 30 minutes when possible.',
  batch: 'Batch prep: longer cooking windows make room for prep-ahead meals.',
  balanced: 'A balanced mix: quick meals and prep-ahead options share the week.',
};

export function describePlanPrepStyle(style: PlanPrepStyle): string {
  return PREP_STYLE_SUMMARIES[style];
}

export function getRepeatedPlanIngredientIds(
  plan: WeeklyMealPlan,
  recipes: readonly Recipe[],
  limit = 3
): IngredientId[] {
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError('Limit must be zero or greater');

  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const counts = new Map<IngredientId, number>();
  for (const entry of plan.entries) {
    if (entry.kind !== 'recipe') continue;
    const recipe = recipesById.get(entry.recipeId);
    if (!recipe) continue;
    for (const ingredientId of new Set(recipe.ingredients.map((ingredient) => ingredient.id))) {
      counts.set(ingredientId, (counts.get(ingredientId) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort(([leftId, leftCount], [rightId, rightCount]) =>
      rightCount === leftCount ? leftId.localeCompare(rightId) : rightCount - leftCount
    )
    .slice(0, limit)
    .map(([ingredientId]) => ingredientId);
}

export function describeIngredientReuse(names: readonly string[]): string {
  if (names.length === 0) {
    return 'Reduced waste: this plan keeps extra ingredients focused.';
  }
  if (names.length === 1) {
    return `Reduced waste: ${names[0]} repeats across meals.`;
  }
  const last = names.at(-1);
  return `Reduced waste: ${names.slice(0, -1).join(', ')} and ${last} repeat across meals.`;
}
