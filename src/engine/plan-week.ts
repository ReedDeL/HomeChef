import {
  recipeWeeklyEntrySchema,
  weeklyMealPlanSchema,
  type RecipeWeeklyEntry,
  type WeeklyMealPlan,
} from '@/contracts/meal-journeys';
import { BUCKET_ORDER } from '@/engine/bucket';
import { hasAllergen, isEquipmentSatisfied, satisfiesDietary } from '@/engine/filter-hard';
import { derivePlanLinkedGroceryNeeds, type PlanGroceryEntry } from '@/engine/plan-grocery-needs';
import { getPortionGuidance, type PortionGuidanceInput } from '@/engine/portion-guidance';
import { scoreRecipe } from '@/engine/score-recipe';
import type {
  Bucket,
  DailyPlanPreference,
  IngredientId,
  Recipe,
  ScoredRecipe,
  UserPreferences,
} from '@/engine/types';

const STANDARD_TIME_TIERS = [15, 30, 60, 120] as const;
const GROCERY_NEED_LIMIT = 12;

export interface PlanWeekInput {
  recipes: readonly Recipe[];
  pantry: ReadonlySet<IngredientId>;
  preferences: UserPreferences;
  days: readonly DailyPlanPreference[];
  tasteSignals: readonly RecipeTasteSignal[];
  portionInput: Pick<
    PortionGuidanceInput,
    'bodyProfile' | 'bodyGoal' | 'bodyMetrics' | 'satietyLevel'
  >;
}

export interface RecipeTasteSignal {
  recipeId: string;
}

interface RankedCandidate {
  scored: ScoredRecipe;
  selectedByPhoto: boolean;
  unused: boolean;
}

interface SelectionStage {
  timeLimit: number;
  cuisineDropped: boolean;
}

export function buildCandidateTimeTiers(selectedLimit: number): number[] {
  if (!Number.isInteger(selectedLimit) || selectedLimit < 1 || selectedLimit > 120) {
    throw new RangeError('Selected limit must be an integer from 1 through 120');
  }

  return [selectedLimit, ...STANDARD_TIME_TIERS.filter((timeTier) => timeTier > selectedLimit)];
}

export function planWeek(input: PlanWeekInput): WeeklyMealPlan {
  const weekStart = validateDays(input.days);

  const photoSelectedRecipeIds = new Set(input.tasteSignals.map((signal) => signal.recipeId));
  const selectedRecipeIds = new Set<string>();
  const groceryEntries: PlanGroceryEntry[] = [];
  const hardSafeRecipes = input.recipes.filter((recipe) =>
    isHardSafeBundledRecipe(recipe, input.preferences)
  );
  const entries: WeeklyMealPlan['entries'][number][] = [];

  for (const day of input.days) {
    const selection = selectRecipeForDay({
      day,
      recipes: hardSafeRecipes,
      pantry: input.pantry,
      preferences: input.preferences,
      photoSelectedRecipeIds,
      selectedRecipeIds,
      groceryEntries,
    });

    if (selection === null) {
      entries.push({ kind: 'day_of_decision', date: day.date, reason: 'no_safe_recipe' });
      continue;
    }

    if (selection.kind === 'grocery_need_cap') {
      entries.push({ kind: 'day_of_decision', date: day.date, reason: 'grocery_need_cap' });
      continue;
    }

    selectedRecipeIds.add(selection.recipe.id);
    groceryEntries.push({ date: day.date, recipe: selection.recipe });
    entries.push(
      createRecipeEntry(day, selection.recipe, selection.statedRelaxations, input.portionInput)
    );
  }

  const statedRelaxations = (['time', 'cuisine'] as const).filter((relaxation) =>
    entries.some((entry) => entry.kind === 'recipe' && entry.statedRelaxations.includes(relaxation))
  );
  const plan: WeeklyMealPlan = {
    weekStart,
    entries,
    status: 'draft',
    groceryNeeds: derivePlanLinkedGroceryNeeds(groceryEntries, input.pantry, GROCERY_NEED_LIMIT),
    statedRelaxations,
  };

  return weeklyMealPlanSchema.parse(plan);
}

interface SelectRecipeForDayInput {
  day: DailyPlanPreference;
  recipes: readonly Recipe[];
  pantry: ReadonlySet<IngredientId>;
  preferences: UserPreferences;
  photoSelectedRecipeIds: ReadonlySet<string>;
  selectedRecipeIds: ReadonlySet<string>;
  groceryEntries: readonly PlanGroceryEntry[];
}

type DaySelection =
  | { kind: 'recipe'; recipe: Recipe; statedRelaxations: ('time' | 'cuisine')[] }
  | { kind: 'grocery_need_cap' };

function selectRecipeForDay(input: SelectRecipeForDayInput): DaySelection | null {
  let foundEligibleCandidate = false;

  for (const stage of buildSelectionStages(input.day, input.preferences.preferredCuisine)) {
    const ranked = rankCandidates(input, stage);
    if (ranked.length > 0) foundEligibleCandidate = true;

    for (const candidate of ranked) {
      const nextGroceryEntries = [
        ...input.groceryEntries,
        { date: input.day.date, recipe: candidate.scored.recipe },
      ];
      if (!fitsGroceryNeedLimit(nextGroceryEntries, input.pantry)) continue;

      const statedRelaxations: ('time' | 'cuisine')[] = [];
      if (stage.timeLimit > input.day.selectedLimit) statedRelaxations.push('time');
      if (stage.cuisineDropped) statedRelaxations.push('cuisine');
      return {
        kind: 'recipe',
        recipe: candidate.scored.recipe,
        statedRelaxations,
      };
    }
  }

  return foundEligibleCandidate ? { kind: 'grocery_need_cap' } : null;
}

function buildSelectionStages(
  day: DailyPlanPreference,
  preferredCuisine: string | null
): SelectionStage[] {
  const tiers = buildCandidateTimeTiers(day.selectedLimit);
  const exactCuisineStages = tiers.map((timeLimit) => ({ timeLimit, cuisineDropped: false }));
  if (preferredCuisine === null) return exactCuisineStages;
  return [
    ...exactCuisineStages,
    ...tiers.map((timeLimit) => ({ timeLimit, cuisineDropped: true })),
  ];
}

function rankCandidates(input: SelectRecipeForDayInput, stage: SelectionStage): RankedCandidate[] {
  return input.recipes
    .filter(
      (recipe) =>
        recipe.totalTimeMinutes <= stage.timeLimit &&
        (stage.cuisineDropped ||
          input.preferences.preferredCuisine === null ||
          recipe.cuisine === input.preferences.preferredCuisine)
    )
    .map((recipe) => ({
      scored: scoreRecipe(recipe, input.pantry, input.preferences, stage.timeLimit),
      selectedByPhoto: input.photoSelectedRecipeIds.has(recipe.id),
      unused: !input.selectedRecipeIds.has(recipe.id),
    }))
    .sort(compareRankedCandidates);
}

function compareRankedCandidates(left: RankedCandidate, right: RankedCandidate): number {
  const readinessDifference = bucketRank(left.scored.bucket) - bucketRank(right.scored.bucket);
  if (readinessDifference !== 0) return readinessDifference;
  if (right.scored.score !== left.scored.score) return right.scored.score - left.scored.score;
  if (left.selectedByPhoto !== right.selectedByPhoto) return left.selectedByPhoto ? -1 : 1;
  if (left.unused !== right.unused) return left.unused ? -1 : 1;
  return compareIds(left.scored.recipe.id, right.scored.recipe.id);
}

function bucketRank(bucket: Bucket): number {
  return BUCKET_ORDER.indexOf(bucket);
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fitsGroceryNeedLimit(
  entries: readonly PlanGroceryEntry[],
  pantry: ReadonlySet<IngredientId>
): boolean {
  try {
    derivePlanLinkedGroceryNeeds(entries, pantry, GROCERY_NEED_LIMIT);
    return true;
  } catch (error: unknown) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

function createRecipeEntry(
  day: DailyPlanPreference,
  recipe: Recipe,
  statedRelaxations: readonly ('time' | 'cuisine')[],
  portionInput: Pick<
    PortionGuidanceInput,
    'bodyProfile' | 'bodyGoal' | 'bodyMetrics' | 'satietyLevel'
  >
): RecipeWeeklyEntry {
  return recipeWeeklyEntrySchema.parse({
    kind: 'recipe',
    date: day.date,
    recipeId: recipe.id,
    plannedMealTime: `${day.date}T${day.mealTime}`,
    statedRelaxations,
    portionGuidance: getPortionGuidance({ recipe, ...portionInput }),
  });
}

function isHardSafeBundledRecipe(recipe: Recipe, preferences: UserPreferences): boolean {
  return (
    recipe.source === 'bundled' &&
    recipe.ingredients.length > 0 &&
    !preferences.dislikedRecipeIds.has(recipe.id) &&
    isEquipmentSatisfied(recipe.equipmentRequired, preferences.equipment) &&
    !hasAllergen(recipe, preferences.allergens) &&
    satisfiesDietary(recipe, preferences.dietary)
  );
}

function validateDays(days: readonly DailyPlanPreference[]): string {
  if (days.length !== 7) throw new RangeError('A weekly plan requires exactly seven days');
  const firstDay = days[0];
  if (firstDay === undefined) throw new RangeError('A weekly plan requires exactly seven days');

  for (const day of days) {
    buildCandidateTimeTiers(day.selectedLimit);
    const plannedMealTime = `${day.date}T${day.mealTime}`;
    const parsedMealTime = recipeWeeklyEntrySchema.safeParse({
      kind: 'recipe',
      date: day.date,
      recipeId: 'validation-recipe',
      plannedMealTime,
      statedRelaxations: [],
      portionGuidance: null,
    });
    if (!parsedMealTime.success) {
      throw new RangeError('Each meal time must be a valid offset-bearing RFC 3339 time');
    }
  }

  const dateValidation = weeklyMealPlanSchema.safeParse({
    weekStart: firstDay.date,
    entries: days.map((day) => ({
      kind: 'day_of_decision',
      date: day.date,
      reason: 'no_safe_recipe',
    })),
    status: 'draft',
    groceryNeeds: [],
    statedRelaxations: [],
  });
  if (!dateValidation.success) {
    throw new RangeError('Plan days must be seven consecutive local dates');
  }

  return firstDay.date;
}
