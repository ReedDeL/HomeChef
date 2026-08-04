/**
 * Hard constraints. These eliminate; they are never relaxed, not at the last
 * rung of the ladder, not ever (docs/01_TECHNICAL_SPEC.md:478).
 *
 * An allergen leak is a safety incident, and recommending a braise to a
 * microwave-only user destroys trust on the first use the whole product rests
 * on. Both failure modes are one-way doors, so both filter rather than rank.
 */
import type { DietaryTag, Equipment, IngredientId, Recipe } from '@/engine/types';

/**
 * A recipe survives only if every item it requires is owned. `none` is always
 * satisfied — it is how the catalog marks a no-cook recipe.
 */
export function isEquipmentSatisfied(
  required: readonly Equipment[],
  owned: readonly Equipment[]
): boolean {
  const ownedSet = new Set(owned);
  return required.every((item) => item === 'none' || ownedSet.has(item));
}

/**
 * Allergen matching is set membership over canonical ids, plus the allergen
 * groups the vocabulary attaches to each ingredient (`butter` -> `dairy`).
 *
 * It is deliberately NOT a substring test. `"egg".includes()` against
 * `"eggplant"`, or `"nut"` against `"coconut"`, produces false positives that
 * silently hide most of the catalog — the bug this replaces.
 */
export function hasAllergen(recipe: Recipe, allergens: readonly IngredientId[]): boolean {
  if (allergens.length === 0) return false;
  const declared = new Set(allergens);

  return recipe.ingredients.some(
    (ing) => declared.has(ing.id) || ing.allergenGroups.some((group) => declared.has(group))
  );
}

/**
 * Dietary selections are restrictions, so they AND together: choosing vegan and
 * gluten-free requires a recipe tagged both. An untagged recipe fails any
 * active restriction — an absent tag is not evidence of compliance, and
 * guessing in the permissive direction is the unsafe one.
 */
export function satisfiesDietary(recipe: Recipe, dietary: readonly DietaryTag[]): boolean {
  if (dietary.length === 0) return true;
  const tags = new Set(recipe.dietaryTags);
  return dietary.every((restriction) => tags.has(restriction));
}
