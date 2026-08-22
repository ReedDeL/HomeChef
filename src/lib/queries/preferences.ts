/**
 * Personal data: preferences, allergens, dietary restrictions, and feedback.
 * These join to `user_id` and are structurally unreachable by household
 * members -- roommates share a pantry, never a diet.
 */
import { getSupabase } from '@/lib/supabase';
import type {
  FeedbackVerdict,
  MealFeedbackRow,
  ProfileRow,
  UserPreferencesRow,
} from '@/types/database';

const PROFILE_COLUMNS = 'id, household_id, display_name, created_at';
const PREFERENCES_COLUMNS = 'user_id, equipment, allergens, dietary, onboarding_done, updated_at';
const FEEDBACK_COLUMNS = 'user_id, recipe_id, verdict, made_on, created_at';

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data as ProfileRow | null) ?? null;
}

export async function fetchPreferences(userId: string): Promise<UserPreferencesRow | null> {
  const { data, error } = await getSupabase()
    .from('user_preferences')
    .select(PREFERENCES_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data as UserPreferencesRow | null) ?? null;
}

export interface PreferencesUpdate {
  equipment?: string[];
  allergens?: string[];
  dietary?: string[];
  onboardingDone?: boolean;
}

export async function updatePreferences(userId: string, update: PreferencesUpdate): Promise<void> {
  const { error } = await getSupabase()
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        ...(update.equipment !== undefined && { equipment: update.equipment }),
        ...(update.allergens !== undefined && { allergens: update.allergens }),
        ...(update.dietary !== undefined && { dietary: update.dietary }),
        ...(update.onboardingDone !== undefined && { onboarding_done: update.onboardingDone }),
      },
      { onConflict: 'user_id' }
    );

  if (error) throw error;
}

export async function fetchFeedback(userId: string): Promise<MealFeedbackRow[]> {
  const { data, error } = await getSupabase()
    .from('meal_feedback')
    .select(FEEDBACK_COLUMNS)
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []) as MealFeedbackRow[];
}

/**
 * `skipped` is a weak negative signal, `disliked` a strong one. Keeping them
 * distinct is what lets the engine de-rank one and eliminate the other.
 */
export async function recordVerdict(
  userId: string,
  recipeId: string,
  verdict: FeedbackVerdict
): Promise<void> {
  const { error } = await getSupabase()
    .from('meal_feedback')
    .upsert({ user_id: userId, recipe_id: recipeId, verdict }, { onConflict: 'user_id,recipe_id' });

  if (error) throw error;
}
