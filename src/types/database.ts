/**
 * Row shapes for the tables in supabase/migrations/.
 *
 * These are now DERIVED from `supabase-generated.ts`, which is emitted by
 *
 *     npx supabase gen types typescript --linked > src/types/supabase-generated.ts
 *
 * against the live project. That file is the source of truth; do not edit it.
 * A column added, dropped, or retyped in a migration now becomes a compile
 * error here the moment the types are regenerated, rather than a hand-written
 * interface that quietly lies about what Postgres will return.
 *
 * This file exists on top of it for one reason: two columns are constrained by
 * a CHECK, not a Postgres enum, so the generator can only see `string`. The
 * unions below restore the domain the database actually enforces.
 */
import type { Tables } from '@/types/supabase-journeys';

/**
 * Narrows a generated `text` column to the union its CHECK constraint permits.
 *
 * `Union extends Row[K]` is the guard: if the column stops being assignable
 * from that union -- someone swaps the CHECK for a real Postgres enum, say --
 * this stops compiling, which is the signal to delete the hand-written union
 * and use the generated `Enums<...>` instead of maintaining it twice.
 */
type NarrowColumn<Row, K extends keyof Row, Union extends Row[K]> = Omit<Row, K> & Record<K, Union>;

export type HouseholdRow = Tables<'households'>;

export type ProfileRow = Tables<'profiles'>;

export type UserPreferencesRow = Tables<'user_preferences'>;

/** `meal_feedback.verdict`, per the CHECK in 0001_initial_schema.sql. */
export type FeedbackVerdict = 'liked' | 'disliked' | 'skipped';

export type MealFeedbackRow = NarrowColumn<Tables<'meal_feedback'>, 'verdict', FeedbackVerdict>;

/** `inventory.source`, tightened by the dual-meal-journeys migration. */
export type InventorySource = 'manual' | 'photo' | 'staple';

export type InventoryRow = NarrowColumn<Tables<'inventory'>, 'source', InventorySource>;

export type CalculationSex = 'female' | 'male';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type BodyGoal = 'lose' | 'maintain' | 'gain';
export type TasteSignalKind = 'photo_selected';
export type MealJourney = 'now' | 'week';
export type MealSatietyLevel = 'still_hungry' | 'satisfied' | 'too_full';
export type WeeklyPlanStatus = 'draft' | 'confirmed';
export type WeeklyEntryKind = 'recipe' | 'day_of_decision';
export type WeeklyEntryReason = 'no_safe_recipe' | 'grocery_need_cap';
export type StatedRelaxation = 'time' | 'cuisine';
export type ReminderLeadMinutes = 0 | 10 | 15 | 30 | 60;

type BodyProfileChecks = NarrowColumn<Tables<'body_profiles'>, 'calculation_sex', CalculationSex>;
type BodyProfileActivity = NarrowColumn<BodyProfileChecks, 'activity_level', ActivityLevel>;
export type BodyProfileRow = NarrowColumn<BodyProfileActivity, 'goal', BodyGoal>;

type TasteSignalKindRow = NarrowColumn<Tables<'taste_signals'>, 'kind', TasteSignalKind>;
export type TasteSignalRow = NarrowColumn<TasteSignalKindRow, 'journey', MealJourney>;

export type MealSatietyRow = NarrowColumn<Tables<'meal_satiety'>, 'level', MealSatietyLevel>;
export type OnboardingProgressRow = Tables<'onboarding_progress'>;

type WeeklyPlanStatusRow = NarrowColumn<Tables<'weekly_meal_plans'>, 'status', WeeklyPlanStatus>;
export type WeeklyMealPlanRow = Omit<WeeklyPlanStatusRow, 'stated_relaxations'> & {
  stated_relaxations: StatedRelaxation[];
};

type WeeklyEntryKindRow = NarrowColumn<Tables<'weekly_meal_plan_entries'>, 'kind', WeeklyEntryKind>;
export type WeeklyMealPlanEntryRow = Omit<WeeklyEntryKindRow, 'reason' | 'stated_relaxations'> & {
  reason: WeeklyEntryReason | null;
  stated_relaxations: StatedRelaxation[];
};

export type PlanLinkedGroceryNeedRow = Tables<'plan_linked_grocery_needs'>;
export type MealReminderPreferencesRow = NarrowColumn<
  Tables<'meal_reminder_preferences'>,
  'lead_minutes',
  ReminderLeadMinutes
>;
