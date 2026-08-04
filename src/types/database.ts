/**
 * Row shapes for the tables in supabase/migrations/0001_initial_schema.sql.
 *
 * Hand-written to match that migration. Once the project exists, regenerate
 * with `npx supabase gen types typescript --local > src/types/database.ts` and
 * treat the generated file as the source of truth; until then, a change to the
 * migration must be mirrored here or the adapters will lie about their input.
 */

export interface HouseholdRow {
  id: string;
  name: string;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  household_id: string;
  display_name: string | null;
  created_at: string;
}

export interface UserPreferencesRow {
  user_id: string;
  equipment: string[];
  allergens: string[];
  dietary: string[];
  onboarding_done: boolean;
  updated_at: string;
}

export type FeedbackVerdict = 'liked' | 'disliked' | 'skipped';

export interface MealFeedbackRow {
  user_id: string;
  recipe_id: string;
  verdict: FeedbackVerdict;
  made_on: string | null;
  created_at: string;
}

export type InventorySource = 'manual' | 'photo' | 'staple' | 'shopping_list';

export interface InventoryRow {
  id: string;
  household_id: string;
  ingredient_id: string;
  quantity: number | null;
  unit: string | null;
  purchased_on: string | null;
  source: InventorySource;
  added_by: string | null;
  updated_at: string;
}
