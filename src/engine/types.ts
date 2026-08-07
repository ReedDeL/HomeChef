/**
 * The entire public data contract of the decision engine.
 *
 * Everything here is plain data. No Supabase row types, no React, no promises.
 * The data layer converts into these types (src/lib/adapters/) and the engine
 * never learns where a recipe came from — bundled Tier 1 or live Tier 2.
 */

/**
 * Canonical ingredient identifier from src/data/ingredients.json.
 *
 * The engine compares these by equality, so "scallion", "green onion", and
 * "spring onion" MUST already have collapsed to one id before reaching here.
 * Free-text ingredient names are a bug at this boundary.
 */
export type IngredientId = string;

export type Minutes = number;

/**
 * Closed equipment enumeration (docs/01_TECHNICAL_SPEC.md:534).
 *
 * Closed is what makes the equipment filter a set operation instead of a
 * string-matching problem. snake_case is canonical; the catalog pipeline emits
 * exactly these values and nothing else.
 */
export const EQUIPMENT = [
  'microwave',
  'stove',
  'oven',
  'air_fryer',
  'kettle',
  'blender',
  'rice_cooker',
  'toaster_oven',
  'none',
  /**
   * Tagging failed; we do not know what this recipe needs. Deliberately NOT
   * `none` -- `none` is a verified claim that nothing is required, and
   * collapsing the two is what served stove recipes to microwave-only users.
   */
  'unclassified',
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

export const DIETARY_TAGS = [
  'vegetarian',
  'vegan',
  'gluten_free',
  'dairy_free',
  'halal',
  'kosher',
  'pescatarian',
  'keto',
] as const;

export type DietaryTag = (typeof DIETARY_TAGS)[number];

export interface RecipeIngredient {
  id: IngredientId;
  /** Display text as written in the source, e.g. "2 1/2 tbsp". */
  measure: string;
  /**
   * Allergen groups this ingredient belongs to, e.g. `butter` -> `['dairy']`.
   * Attached by the adapter from the bundled ingredient vocabulary so that
   * allergen checking stays a set operation instead of a substring search.
   *
   * Substring matching is the bug this field exists to prevent: `"egg"`
   * matches `"eggplant"`, `"nut"` matches `"coconut"`.
   */
  allergenGroups: IngredientId[];
}

export interface Recipe {
  id: string;
  title: string;
  imageUrl: string | null;
  cuisine: string | null;
  totalTimeMinutes: Minutes;
  equipmentRequired: Equipment[];
  dietaryTags: DietaryTag[];
  ingredients: RecipeIngredient[];
  instructions: string;
  /**
   * Which tier supplied this recipe. The engine ignores it entirely; it exists
   * so the persistence layer can enforce the Spoonacular field whitelist and
   * the UI can render attribution.
   */
  source: 'tier1' | 'tier2';
}

export interface UserPreferences {
  equipment: Equipment[];
  /** Canonical ingredient ids the user must never be shown. */
  allergens: IngredientId[];
  dietary: DietaryTag[];
  /** Strong negative signal — suppress permanently. */
  dislikedRecipeIds: Set<string>;
  /** Weak negative signal — de-rank, do not eliminate. */
  skippedRecipeIds: Set<string>;
  /** Soft preference; the first thing dropped during relaxation after time. */
  preferredCuisine: string | null;
}

export type Bucket = 'ready' | 'missing_few' | 'missing_some' | 'grocery_run';

export interface ScoredRecipe {
  recipe: Recipe;
  missing: IngredientId[];
  bucket: Bucket;
  score: number;
}

/**
 * Which soft constraints the engine had to give up to avoid an empty screen.
 * Every one of these is stated out loud in the UI — silent filter changes are
 * how an app teaches a user not to trust it.
 *
 * `tier2_escalation` is the one exception: it adds options without removing
 * constraints, so there is nothing to disclose (docs/01_TECHNICAL_SPEC.md:480).
 */
export type Relaxation =
  | { kind: 'time_widened'; from: Minutes; to: Minutes }
  | { kind: 'cuisine_dropped'; cuisine: string }
  | { kind: 'tier2_escalation' }
  | { kind: 'bucket_promoted'; bucket: Bucket };

export interface DecisionResult {
  buckets: Record<Bucket, ScoredRecipe[]>;
  appliedRelaxations: Relaxation[];
}
