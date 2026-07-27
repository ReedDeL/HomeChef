/** Equipment tiers from the product doc — declared once during onboarding. */
export type Equipment =
  | 'microwave'
  | 'kettle'
  | 'hot-plate'
  | 'stove'
  | 'oven'
  | 'air-fryer'
  | 'rice-cooker'
  | 'blender'
  | 'toaster-oven';

/** Standard dietary labels a recipe can satisfy; matched against onboarding preferences. */
export type DietaryTag =
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'dairy-free'
  | 'halal'
  | 'kosher'
  | 'pescatarian'
  | 'keto';

export interface RecipeIngredient {
  name: string;
  measure: string;
}

/** Shape produced by scripts/build_catalog.py and bundled in recipes.json. */
export interface BundledRecipe {
  id: string;
  name: string;
  category: string | null;
  cuisine: string | null;
  cookTimeMinutes: number | null;
  requiredEquipment: Equipment[];
  dietaryTags: DietaryTag[];
  imageUrl: string | null;
  instructions: string;
  ingredients: RecipeIngredient[];
}
