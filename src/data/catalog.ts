import recipesJson from '@/data/recipes.json';
import ingredientsJson from '@/data/ingredients.json';
import { toCatalog } from '@/lib/adapters/to-recipe';
import type { Recipe } from '@/engine/types';

export interface VocabularyEntry {
  id: string;
  displayName: string;
  allergenGroups: string[];
  isStaple: boolean;
}

/**
 * Transitional bundled catalog. It is present immediately for offline
 * decisions while the approved hosted release remains optional.
 *
 * Parsed once at module load. ~300 recipes is small enough that this costs
 * nothing measurable and saves re-validating on every render.
 */
export const OFFLINE_TRANSITIONAL_CATALOG: readonly Recipe[] = toCatalog(recipesJson);

/**
 * The canonical ingredient vocabulary — the shared language between the vision
 * pipeline, the pantry, and the decision engine.
 */
export const INGREDIENT_VOCABULARY: readonly VocabularyEntry[] =
  ingredientsJson as VocabularyEntry[];

const BY_ID = new Map(INGREDIENT_VOCABULARY.map((entry) => [entry.id, entry]));

export function lookupIngredient(id: string): VocabularyEntry | undefined {
  return BY_ID.get(id);
}

/** Pre-populated on first run so a brand-new pantry is not empty. */
export const STAPLE_INGREDIENT_IDS: readonly string[] = INGREDIENT_VOCABULARY.filter(
  (entry) => entry.isStaple
).map((entry) => entry.id);
