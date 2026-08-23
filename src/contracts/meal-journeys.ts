import { z } from 'zod';

export const mealJourneySchema = z.enum(['now', 'week']);
export type MealJourney = z.infer<typeof mealJourneySchema>;

export const bodyGoalSchema = z.enum(['lose', 'maintain', 'gain']);
export type BodyGoal = z.infer<typeof bodyGoalSchema>;

export const activityLevelSchema = z.enum([
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);
export type ActivityLevel = z.infer<typeof activityLevelSchema>;

export const calculationSexSchema = z.enum(['female', 'male']);
export type CalculationSex = z.infer<typeof calculationSexSchema>;

export const nutritionConfidenceSchema = z.enum(['high', 'medium', 'low', 'unavailable']);
export type NutritionConfidence = z.infer<typeof nutritionConfidenceSchema>;

export const tasteSignalKindSchema = z.literal('photo_selected');
export type TasteSignalKind = z.infer<typeof tasteSignalKindSchema>;

export const mealSatietyLevelSchema = z.enum(['still_hungry', 'satisfied', 'too_full']);
export type MealSatietyLevel = z.infer<typeof mealSatietyLevelSchema>;

export const continuousOnboardingPromptKindSchema = z.enum([
  'safety',
  'week_preference',
  'photo_taste',
  'body_profile',
  'reminder',
]);
export type ContinuousOnboardingPromptKind = z.infer<typeof continuousOnboardingPromptKindSchema>;

export const weeklyEntryKindSchema = z.enum(['recipe', 'day_of_decision']);
export type WeeklyEntryKind = z.infer<typeof weeklyEntryKindSchema>;

export const weeklyPlanStatusSchema = z.enum(['draft', 'confirmed']);
export type WeeklyPlanStatus = z.infer<typeof weeklyPlanStatusSchema>;

export const reminderLeadMinutesSchema = z.union([
  z.literal(0),
  z.literal(10),
  z.literal(15),
  z.literal(30),
  z.literal(60),
]);
export type ReminderLeadMinutes = z.infer<typeof reminderLeadMinutesSchema>;

const nonEmptyIdSchema = z.string().min(1);
const timestampSchema = z.iso.datetime({ offset: true });
const localDateSchema = z.iso.date();
const statedRelaxationSchema = z.enum(['time', 'cuisine']);

export const bodyProfileSchema = z.strictObject({
  ageYears: z.number().int().min(18).max(120),
  heightCentimeters: z.number().min(120).max(230),
  weightKilograms: z.number().min(35).max(300),
  calculationSex: calculationSexSchema,
  activityLevel: activityLevelSchema,
  goal: bodyGoalSchema,
  pregnant: z.boolean(),
  breastfeeding: z.boolean(),
});
export type BodyProfile = z.infer<typeof bodyProfileSchema>;

export const tasteSignalSchema = z.strictObject({
  kind: tasteSignalKindSchema,
  recipeId: nonEmptyIdSchema,
  journey: mealJourneySchema,
  recordedAt: timestampSchema,
});
export type TasteSignal = z.infer<typeof tasteSignalSchema>;

export const mealSatietyInputSchema = z.strictObject({
  recipeId: nonEmptyIdSchema,
  level: mealSatietyLevelSchema,
});
export type MealSatietyInput = z.infer<typeof mealSatietyInputSchema>;

export const mealSatietyRecordSchema = z.strictObject({
  id: z.uuid(),
  userId: z.uuid(),
  recordedAt: timestampSchema,
  recipeId: nonEmptyIdSchema,
  level: mealSatietyLevelSchema,
});
export type MealSatietyRecord = z.infer<typeof mealSatietyRecordSchema>;

export const portionGuidanceSchema = z.strictObject({
  servings: z
    .number()
    .min(0.75)
    .max(1.5)
    .refine((servings) => Number.isInteger(servings * 4), 'Servings must use quarter increments'),
  label: z.string().regex(/^Start with .+ servings?$/),
  disclaimer: z.literal('Estimate only—adjust to your hunger.'),
});
export type PortionGuidance = z.infer<typeof portionGuidanceSchema>;

export const continuousOnboardingProgressSchema = z.strictObject({
  safetyCompleted: z.boolean(),
  weekPreferenceCompleted: z.boolean(),
  photoTasteCompleted: z.boolean(),
  bodyProfileCompleted: z.boolean(),
  reminderCompleted: z.boolean(),
  updatedAt: timestampSchema,
});
export type ContinuousOnboardingProgress = z.infer<typeof continuousOnboardingProgressSchema>;

export const continuousOnboardingPromptStateSchema = z
  .strictObject({
    shownThisSession: z.boolean(),
    activePrompt: continuousOnboardingPromptKindSchema.nullable(),
  })
  .refine((state) => state.shownThisSession || state.activePrompt === null, {
    message: 'An active prompt requires shownThisSession',
    path: ['activePrompt'],
  });
export type ContinuousOnboardingPromptState = z.infer<typeof continuousOnboardingPromptStateSchema>;

export const mealReminderPreferencesSchema = z.strictObject({
  enabled: z.boolean(),
  leadMinutes: reminderLeadMinutesSchema,
  updatedAt: timestampSchema,
});
export type MealReminderPreferences = z.infer<typeof mealReminderPreferencesSchema>;

const plannedMealTimeSchema = z.iso
  .datetime({ offset: true })
  .regex(/[+-]\d{2}:\d{2}$/, 'A numeric UTC offset is required');

export const recipeWeeklyEntrySchema = z
  .strictObject({
    kind: z.literal('recipe'),
    date: localDateSchema,
    recipeId: nonEmptyIdSchema,
    plannedMealTime: plannedMealTimeSchema,
    statedRelaxations: z.array(statedRelaxationSchema),
    portionGuidance: portionGuidanceSchema.nullable(),
  })
  .refine((entry) => entry.plannedMealTime.startsWith(`${entry.date}T`), {
    message: 'The planned meal time local date must match date',
    path: ['plannedMealTime'],
  });
export type RecipeWeeklyEntry = z.infer<typeof recipeWeeklyEntrySchema>;

export const dayOfDecisionWeeklyEntrySchema = z.strictObject({
  kind: z.literal('day_of_decision'),
  date: localDateSchema,
  reason: z.enum(['no_safe_recipe', 'grocery_need_cap']),
});
export type DayOfDecisionWeeklyEntry = z.infer<typeof dayOfDecisionWeeklyEntrySchema>;

export const planLinkedGroceryNeedSchema = z.strictObject({
  ingredientId: nonEmptyIdSchema,
  recipeIds: z.array(nonEmptyIdSchema).min(1),
  dates: z.array(localDateSchema).min(1),
});
export type PlanLinkedGroceryNeed = z.infer<typeof planLinkedGroceryNeedSchema>;

const weeklyEntrySchema = z.union([recipeWeeklyEntrySchema, dayOfDecisionWeeklyEntrySchema]);

export const weeklyMealPlanSchema = z
  .strictObject({
    weekStart: localDateSchema,
    entries: z.array(weeklyEntrySchema).length(7),
    status: weeklyPlanStatusSchema,
    groceryNeeds: z.array(planLinkedGroceryNeedSchema).max(12),
    statedRelaxations: z.array(statedRelaxationSchema),
  })
  .superRefine((plan, context) => {
    if (
      !isSevenDayWeek(
        plan.weekStart,
        plan.entries.map((entry) => entry.date)
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Entries must cover seven consecutive dates beginning at weekStart',
        path: ['entries'],
      });
    }

    const ingredientIds = plan.groceryNeeds.map((need) => need.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Grocery needs must have unique ingredient IDs',
        path: ['groceryNeeds'],
      });
    }
  });
export type WeeklyMealPlan = z.infer<typeof weeklyMealPlanSchema>;

export const dualMealJourneysFixtureSchema = z.strictObject({
  mealJourney: mealJourneySchema,
  nutritionConfidence: nutritionConfidenceSchema,
  bodyProfile: bodyProfileSchema,
  tasteSignal: tasteSignalSchema,
  mealSatietyInput: mealSatietyInputSchema,
  mealSatietyRecord: mealSatietyRecordSchema,
  onboardingProgress: continuousOnboardingProgressSchema,
  onboardingPromptState: continuousOnboardingPromptStateSchema,
  reminderPreferences: mealReminderPreferencesSchema,
  weeklyMealPlan: weeklyMealPlanSchema,
});
export type DualMealJourneysFixture = z.infer<typeof dualMealJourneysFixtureSchema>;

export const mealJourneysJsonSchema = z.toJSONSchema(dualMealJourneysFixtureSchema);

function isSevenDayWeek(weekStart: string, dates: readonly string[]): boolean {
  const weekStartMilliseconds = Date.parse(`${weekStart}T00:00:00Z`);
  return dates.every((date, index) => {
    const expectedMilliseconds = weekStartMilliseconds + index * 24 * 60 * 60 * 1_000;
    return Date.parse(`${date}T00:00:00Z`) === expectedMilliseconds;
  });
}
