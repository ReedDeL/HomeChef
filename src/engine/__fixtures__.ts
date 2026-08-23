/**
 * Test fixtures. Builders default to a recipe that passes every filter, so a
 * test only states the one thing it cares about.
 */
import type {
  BodyProfile,
  ContinuousOnboardingProgress,
  ContinuousOnboardingPromptState,
} from '@/contracts/meal-journeys';
import type {
  DietaryTag,
  Equipment,
  IngredientId,
  Recipe,
  RecipeIngredient,
  UserPreferences,
} from '@/engine/types';

export function makeBodyProfile(overrides: Partial<BodyProfile> = {}): BodyProfile {
  return {
    ageYears: 32,
    heightCentimeters: 168,
    weightKilograms: 68.5,
    calculationSex: 'female',
    activityLevel: 'moderate',
    goal: 'maintain',
    pregnant: false,
    breastfeeding: false,
    ...overrides,
  };
}

export function makeOnboardingProgress(
  overrides: Partial<ContinuousOnboardingProgress> = {}
): ContinuousOnboardingProgress {
  return {
    safetyCompleted: false,
    weekPreferenceCompleted: false,
    photoTasteCompleted: false,
    bodyProfileCompleted: false,
    reminderCompleted: false,
    updatedAt: '2026-08-23T12:00:00Z',
    ...overrides,
  };
}

export function makeOnboardingPromptState(
  overrides: Partial<ContinuousOnboardingPromptState> = {}
): ContinuousOnboardingPromptState {
  return {
    shownThisSession: false,
    activePrompt: null,
    ...overrides,
  };
}

export function ingredient(
  id: IngredientId,
  allergenGroups: IngredientId[] = []
): RecipeIngredient {
  return { id, measure: '1 unit', allergenGroups };
}

export function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    title: 'Test Recipe',
    imageUrl: null,
    cuisine: 'american',
    totalTimeMinutes: 15,
    equipmentRequired: ['none'],
    dietaryTags: [],
    ingredients: [ingredient('egg'), ingredient('salt')],
    instructions: 'Cook it.',
    baseServings: null,
    energyKcalPerServing: null,
    nutritionProvenance: null,
    nutritionConfidence: 'unavailable',
    source: 'tier1',
    ...overrides,
  };
}

/** A recipe needing exactly `count` ingredients, ids `i0`..`i{count-1}`. */
export function makeRecipeWithIngredients(count: number, overrides: Partial<Recipe> = {}): Recipe {
  return makeRecipe({
    ingredients: Array.from({ length: count }, (_, i) => ingredient(`i${i}`)),
    ...overrides,
  });
}

export function makePrefs(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    equipment: [...ALL_EQUIPMENT],
    allergens: [],
    dietary: [],
    dislikedRecipeIds: new Set<string>(),
    skippedRecipeIds: new Set<string>(),
    preferredCuisine: null,
    ...overrides,
  };
}

export const ALL_EQUIPMENT: Equipment[] = [
  'microwave',
  'stove',
  'oven',
  'air_fryer',
  'kettle',
  'blender',
  'rice_cooker',
  'toaster_oven',
  'none',
];

export const ALL_DIETARY: DietaryTag[] = [
  'vegetarian',
  'vegan',
  'gluten_free',
  'dairy_free',
  'halal',
  'kosher',
  'pescatarian',
  'keto',
];

export function pantry(...ids: IngredientId[]): Set<IngredientId> {
  return new Set(ids);
}
