import { z } from 'zod';

import {
  bodyProfileSchema,
  continuousOnboardingProgressSchema,
  mealReminderPreferencesSchema,
  mealSatietyInputSchema,
  tasteSignalSchema,
  weeklyMealPlanSchema,
  type WeeklyMealPlan,
} from '@/contracts/meal-journeys';
import type { Recipe } from '@/engine/types';

const onboardingMutableSchema = continuousOnboardingProgressSchema.omit({ updatedAt: true });
const reminderMutableSchema = mealReminderPreferencesSchema.omit({ updatedAt: true });
const uuidSchema = z.uuid();
const WEEKLY_PLAN_CREATION_RPC = 'create_weekly_meal_plan' as const;
const WEEKLY_CHILD_REPLACEMENT_RPC = 'replace_weekly_plan_children' as const;

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Persistence input must be an object');
  }
  return value as Record<string, unknown>;
}

function parseUserId(userId: string): string {
  return uuidSchema.parse(userId);
}

function toBodyProfileUpsert(userId: string, input: unknown) {
  const value = asRecord(input);
  const profile = bodyProfileSchema.parse({
    ageYears: value.ageYears,
    heightCentimeters: value.heightCentimeters,
    weightKilograms: value.weightKilograms,
    calculationSex: value.calculationSex,
    activityLevel: value.activityLevel,
    goal: value.goal,
    pregnant: value.pregnant,
    breastfeeding: value.breastfeeding,
  });

  return {
    user_id: parseUserId(userId),
    age_years: profile.ageYears,
    height_centimeters: profile.heightCentimeters,
    weight_kilograms: profile.weightKilograms,
    calculation_sex: profile.calculationSex,
    activity_level: profile.activityLevel,
    goal: profile.goal,
    pregnant: profile.pregnant,
    breastfeeding: profile.breastfeeding,
  };
}

function toBodyProfileDelete(userId: string) {
  return { user_id: parseUserId(userId) };
}

function toTasteSignalInsert(userId: string, input: unknown) {
  const value = asRecord(input);
  const signal = tasteSignalSchema.parse({
    kind: value.kind,
    recipeId: value.recipeId,
    journey: value.journey,
    recordedAt: value.recordedAt,
  });

  return {
    user_id: parseUserId(userId),
    kind: signal.kind,
    recipe_id: signal.recipeId,
    journey: signal.journey,
    recorded_at: signal.recordedAt,
  };
}

function toMealSatietyInsert(input: unknown) {
  const satiety = mealSatietyInputSchema.parse(input);
  return { recipe_id: satiety.recipeId, level: satiety.level };
}

function toOnboardingProgressUpsert(userId: string, input: unknown) {
  const value = asRecord(input);
  const progress = onboardingMutableSchema.parse({
    safetyCompleted: value.safetyCompleted,
    weekPreferenceCompleted: value.weekPreferenceCompleted,
    photoTasteCompleted: value.photoTasteCompleted,
    bodyProfileCompleted: value.bodyProfileCompleted,
    reminderCompleted: value.reminderCompleted,
  });

  return {
    user_id: parseUserId(userId),
    safety_completed: progress.safetyCompleted,
    week_preference_completed: progress.weekPreferenceCompleted,
    photo_taste_completed: progress.photoTasteCompleted,
    body_profile_completed: progress.bodyProfileCompleted,
    reminder_completed: progress.reminderCompleted,
  };
}

function toMealReminderPreferencesUpsert(userId: string, input: unknown) {
  const value = asRecord(input);
  const preferences = reminderMutableSchema.parse({
    enabled: value.enabled,
    leadMinutes: value.leadMinutes,
  });
  return {
    user_id: parseUserId(userId),
    enabled: preferences.enabled,
    lead_minutes: preferences.leadMinutes,
  };
}

function parseWeeklyPlan(plan: WeeklyMealPlan): WeeklyMealPlan {
  return weeklyMealPlanSchema.parse(plan);
}

function assertBundledRecipeIds(plan: WeeklyMealPlan, catalog: readonly Recipe[]): void {
  const bundledIds = new Set(
    catalog
      .filter((recipe) => recipe.source === 'bundled')
      .map((recipe) => recipe.id)
  );
  for (const entry of plan.entries) {
    if (entry.kind === 'recipe' && !bundledIds.has(entry.recipeId)) {
      throw new TypeError(`Recipe ${entry.recipeId} is not in the bundled catalog`);
    }
  }

  const concreteEntryIds = new Set(
    plan.entries.flatMap((entry) => (entry.kind === 'recipe' ? [entry.recipeId] : []))
  );
  for (const need of plan.groceryNeeds) {
    for (const recipeId of need.recipeIds) {
      if (!bundledIds.has(recipeId)) {
        throw new TypeError(`Recipe ${recipeId} is not in the bundled catalog`);
      }
      if (!concreteEntryIds.has(recipeId)) {
        throw new TypeError(`Recipe ${recipeId} is not a concrete recipe entry`);
      }
    }
  }
}

function toWeeklyPlanChildPayload(plan: WeeklyMealPlan) {
  return {
    entries: plan.entries.map((entry) => {
      if (entry.kind === 'day_of_decision') {
        return {
          entry_date: entry.date,
          kind: entry.kind,
          recipe_id: null,
          planned_meal_time: null,
          reason: entry.reason,
          stated_relaxations: [],
          portion_servings: null,
          portion_label: null,
          portion_disclaimer: null,
        };
      }

      return {
        entry_date: entry.date,
        kind: entry.kind,
        recipe_id: entry.recipeId,
        planned_meal_time: entry.plannedMealTime,
        reason: null,
        stated_relaxations: [...entry.statedRelaxations],
        portion_servings: entry.portionGuidance?.servings ?? null,
        portion_label: entry.portionGuidance?.label ?? null,
        portion_disclaimer: entry.portionGuidance?.disclaimer ?? null,
      };
    }),
    groceryNeeds: plan.groceryNeeds.map((need) => ({
      ingredient_id: need.ingredientId,
      recipe_ids: [...need.recipeIds],
      dates: [...need.dates],
    })),
  };
}

function toWeeklyPlanCreation(userId: string, input: WeeklyMealPlan, catalog: readonly Recipe[]) {
  parseUserId(userId);
  const plan = parseWeeklyPlan(input);
  assertBundledRecipeIds(plan, catalog);
  const children = toWeeklyPlanChildPayload(plan);
  return {
    operation: WEEKLY_PLAN_CREATION_RPC,
    parent: {
      week_start: plan.weekStart,
      status: plan.status,
      stated_relaxations: [...plan.statedRelaxations],
    },
    ...children,
  };
}

function toWeeklyPlanReplacement(
  userId: string,
  planId: string,
  input: WeeklyMealPlan,
  catalog: readonly Recipe[]
) {
  const ownerId = parseUserId(userId);
  const parentId = uuidSchema.parse(planId);
  const plan = parseWeeklyPlan(input);
  assertBundledRecipeIds(plan, catalog);
  const children = toWeeklyPlanChildPayload(plan);

  return {
    operation: WEEKLY_CHILD_REPLACEMENT_RPC,
    deleteExisting: { plan_id: parentId, user_id: ownerId },
    entries: children.entries.map((entry) => ({
      plan_id: parentId,
      user_id: ownerId,
      ...entry,
    })),
    groceryNeeds: children.groceryNeeds.map((need) => ({
      plan_id: parentId,
      user_id: ownerId,
      ...need,
    })),
  };
}

function toWeeklyPlanConfirmation(userId: string, planId: string) {
  return {
    filter: { id: uuidSchema.parse(planId), user_id: parseUserId(userId) },
    update: { status: 'confirmed' as const },
  };
}

export const bodyProfilePersistence = {
  toUpsert: toBodyProfileUpsert,
  toDelete: toBodyProfileDelete,
} as const;

export const tasteSignalPersistence = { toInsert: toTasteSignalInsert } as const;

export const mealSatietyPersistence = { toInsert: toMealSatietyInsert } as const;

export const onboardingProgressPersistence = {
  toUpsert: toOnboardingProgressUpsert,
} as const;

export const weeklyPlanPersistence = {
  toCreation: toWeeklyPlanCreation,
  toReplacement: toWeeklyPlanReplacement,
  toConfirmation: toWeeklyPlanConfirmation,
} as const;

export const mealReminderPreferencesPersistence = {
  toUpsert: toMealReminderPreferencesUpsert,
} as const;
