/**
 * Postgres rows in, engine types out.
 *
 * This module and its sibling are the only places that know both worlds. The
 * engine never sees a row type, and the query layer never sees an engine type.
 */
import { DIETARY_TAGS, EQUIPMENT } from '@/engine/types';
import type { DietaryTag, Equipment, IngredientId, UserPreferences } from '@/engine/types';
import type { InventoryRow, MealFeedbackRow, UserPreferencesRow } from '@/types/database';

/**
 * The pantry is a membership test, not a quantity ledger: the engine asks "do
 * you have it", never "how much". A row with quantity 0 or null still counts as
 * present, because the user deleting the row is the signal for "I don't have
 * this" -- that is what the one-tap drift correction writes.
 */
export function toPantrySet(rows: readonly InventoryRow[]): Set<IngredientId> {
  return new Set(rows.map((row) => row.ingredient_id));
}

export function toUserPreferences(
  row: UserPreferencesRow | null,
  feedback: readonly MealFeedbackRow[]
): UserPreferences {
  const disliked = new Set<string>();
  const skipped = new Set<string>();

  for (const entry of feedback) {
    if (entry.verdict === 'disliked') disliked.add(entry.recipe_id);
    else if (entry.verdict === 'skipped') skipped.add(entry.recipe_id);
  }

  return {
    // Filtered rather than cast: a value outside the closed enum -- written by
    // a stale client, or a migration mid-rollout -- would otherwise reach a
    // hard-constraint filter that has no case for it.
    equipment: keepKnown(row?.equipment, EQUIPMENT),
    allergens: row?.allergens ?? [],
    dietary: keepKnown(row?.dietary, DIETARY_TAGS),
    dislikedRecipeIds: disliked,
    skippedRecipeIds: skipped,
    // Chosen per-session on the home screen, not persisted.
    preferredCuisine: null,
  };
}

function keepKnown<T extends Equipment | DietaryTag>(
  values: readonly string[] | undefined,
  allowed: readonly T[]
): T[] {
  if (!values) return [];
  const allowedSet = new Set<string>(allowed);
  return values.filter((value): value is T => allowedSet.has(value));
}
