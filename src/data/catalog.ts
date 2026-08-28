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
 * Curated household staple recipes always available offline.
 * Ensures everyday combinations (e.g. PB&J, grilled cheese, scrambled eggs)
 * produce immediate, obvious recommendations.
 */
export const STAPLE_RECIPES: readonly Recipe[] = [
  {
    id: 'hc-staple-pbj',
    title: 'Peanut Butter and Jelly Sandwich',
    imageUrl: null,
    cuisine: null,
    totalTimeMinutes: 5,
    equipmentRequired: ['none'],
    dietaryTags: ['vegetarian', 'vegan', 'dairy_free'],
    ingredients: [
      { id: 'bread', measure: '2 slices', allergenGroups: ['gluten', 'wheat'] },
      { id: 'peanut_butter', measure: '2 tbsp', allergenGroups: ['nut', 'peanut'] },
      { id: 'jam', measure: '1 tbsp', allergenGroups: [] },
    ],
    instructions:
      'Spread peanut butter evenly over one slice of bread and jam over the other slice. Press the slices together and cut in half if desired.',
    baseServings: 1,
    energyKcalPerServing: null,
    nutritionConfidence: 'unavailable',
    nutritionProvenance: null,
    source: 'bundled',
  },
  {
    id: 'hc-staple-grilled-cheese',
    title: 'Classic Grilled Cheese',
    imageUrl: null,
    cuisine: null,
    totalTimeMinutes: 10,
    equipmentRequired: ['stove'],
    dietaryTags: ['vegetarian'],
    ingredients: [
      { id: 'bread', measure: '2 slices', allergenGroups: ['gluten', 'wheat'] },
      { id: 'cheddar_cheese', measure: '2 slices', allergenGroups: ['dairy'] },
      { id: 'butter', measure: '1 tbsp', allergenGroups: ['dairy'] },
    ],
    instructions:
      'Butter one side of each bread slice. Place one slice butter-side down in a skillet over medium heat, layer with cheddar cheese, and top with the second bread slice butter-side up. Cook for 3-4 minutes until golden, flip, and cook until cheese is melted.',
    baseServings: 1,
    energyKcalPerServing: null,
    nutritionConfidence: 'unavailable',
    nutritionProvenance: null,
    source: 'bundled',
  },
  {
    id: 'hc-staple-toast-jam',
    title: 'Toast with Butter and Jam',
    imageUrl: null,
    cuisine: null,
    totalTimeMinutes: 5,
    equipmentRequired: ['none'],
    dietaryTags: ['vegetarian'],
    ingredients: [
      { id: 'bread', measure: '2 slices', allergenGroups: ['gluten', 'wheat'] },
      { id: 'butter', measure: '1 tbsp', allergenGroups: ['dairy'] },
      { id: 'jam', measure: '1 tbsp', allergenGroups: [] },
    ],
    instructions:
      'Toast bread slices until golden brown. Spread butter evenly while warm, then spread jam over top.',
    baseServings: 1,
    energyKcalPerServing: null,
    nutritionConfidence: 'unavailable',
    nutritionProvenance: null,
    source: 'bundled',
  },
  {
    id: 'hc-staple-scrambled-eggs',
    title: 'Classic Scrambled Eggs',
    imageUrl: null,
    cuisine: null,
    totalTimeMinutes: 5,
    equipmentRequired: ['stove'],
    dietaryTags: ['vegetarian', 'gluten_free', 'keto'],
    ingredients: [
      { id: 'egg', measure: '2 large', allergenGroups: ['egg'] },
      { id: 'butter', measure: '1 tbsp', allergenGroups: ['dairy'] },
      { id: 'salt', measure: 'a pinch', allergenGroups: [] },
      { id: 'black_pepper', measure: 'a pinch', allergenGroups: [] },
    ],
    instructions:
      'Whisk eggs with salt and black pepper in a bowl. Melt butter in a non-stick skillet over medium-low heat. Pour in the eggs and gently stir with a spatula until soft curds form and eggs are just set (about 2-3 minutes). Remove from heat immediately.',
    baseServings: 1,
    energyKcalPerServing: null,
    nutritionConfidence: 'unavailable',
    nutritionProvenance: null,
    source: 'bundled',
  },
  {
    id: 'hc-staple-tuna-sandwich',
    title: 'Simple Tuna Salad Sandwich',
    imageUrl: null,
    cuisine: null,
    totalTimeMinutes: 5,
    equipmentRequired: ['none'],
    dietaryTags: ['pescatarian', 'dairy_free'],
    ingredients: [
      { id: 'bread', measure: '2 slices', allergenGroups: ['gluten', 'wheat'] },
      { id: 'tuna', measure: '1 can (5 oz)', allergenGroups: ['fish'] },
      { id: 'mayonnaise', measure: '2 tbsp', allergenGroups: ['egg'] },
      { id: 'salt', measure: 'to taste', allergenGroups: [] },
      { id: 'black_pepper', measure: 'to taste', allergenGroups: [] },
    ],
    instructions:
      'Drain tuna and mix with mayonnaise, salt, and pepper in a small bowl. Spread tuna salad between two slices of bread, slice in half, and serve.',
    baseServings: 1,
    energyKcalPerServing: null,
    nutritionConfidence: 'unavailable',
    nutritionProvenance: null,
    source: 'bundled',
  },
  {
    id: 'hc-staple-cinnamon-toast',
    title: 'Cinnamon Sugar Toast',
    imageUrl: null,
    cuisine: null,
    totalTimeMinutes: 5,
    equipmentRequired: ['none'],
    dietaryTags: ['vegetarian'],
    ingredients: [
      { id: 'bread', measure: '2 slices', allergenGroups: ['gluten', 'wheat'] },
      { id: 'butter', measure: '1 tbsp', allergenGroups: ['dairy'] },
      { id: 'cinnamon', measure: '1/2 tsp', allergenGroups: [] },
      { id: 'sugar', measure: '1 tsp', allergenGroups: [] },
    ],
    instructions:
      'Toast bread slices until golden brown. Spread butter over warm toast, then sprinkle evenly with mixed sugar and cinnamon.',
    baseServings: 1,
    energyKcalPerServing: null,
    nutritionConfidence: 'unavailable',
    nutritionProvenance: null,
    source: 'bundled',
  },
];

/**
 * The bundled catalog, combining verified curated staple recipes with the
 * generated offline catalog. Always present, works offline, and ensures common
 * pantry combinations immediately yield relevant suggestions.
 */
export const BUNDLED_CATALOG: readonly Recipe[] = [...STAPLE_RECIPES, ...toCatalog(recipesJson)];

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
