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
import type { Tables } from '@/types/supabase-generated';

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

/** `meal_satiety.level`, per the CHECK in 0005_add_meal_satiety.sql. */
export type MealSatietyLevel = 'still_hungry' | 'satisfied' | 'too_full';

export type MealSatietyRow = NarrowColumn<Tables<'meal_satiety'>, 'level', MealSatietyLevel>;

/** `inventory.source`, per the CHECK in 0001_initial_schema.sql. */
export type InventorySource = 'manual' | 'photo' | 'staple' | 'shopping_list';

export type InventoryRow = NarrowColumn<Tables<'inventory'>, 'source', InventorySource>;
