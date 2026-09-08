import { z } from 'zod';

import { lookupIngredient } from '@/data/catalog';
import type { IngredientId } from '@/engine/types';

export const ingredientCategorySchema = z.enum([
  'produce',
  'protein',
  'dairy',
  'dry pantry',
  'seasoning',
  'ingredient',
]);
export type IngredientCategory = z.infer<typeof ingredientCategorySchema>;

export const ingredientArtSchema = z.enum([
  'egg',
  'milk',
  'butter',
  'cheese',
  'chicken',
  'beef',
  'yogurt',
  'rice',
  'oats',
  'pasta',
  'bread',
  'flour',
  'sugar',
  'onion',
  'garlic',
  'potato',
  'tomato',
  'carrot',
  'lemon',
  'apple',
  'banana',
  'oil',
  'salt',
  'pepper',
  'fallback',
]);
export type IngredientArt = z.infer<typeof ingredientArtSchema>;

export const ingredientPresentationSchema = z.object({
  category: ingredientCategorySchema,
  art: ingredientArtSchema,
  detail: z.string().min(1),
});
export type IngredientPresentation = z.infer<typeof ingredientPresentationSchema>;

export function validateIngredientPresentation(data: unknown): IngredientPresentation {
  return ingredientPresentationSchema.parse(data);
}

/** Original local artwork; see assets/ingredient-art/PROVENANCE.md. */
const COMMON_PRESENTATION: Readonly<Record<string, IngredientPresentation>> = {
  egg: { category: 'protein', art: 'egg', detail: 'Protein' },
  milk: { category: 'dairy', art: 'milk', detail: 'Refrigerated dairy' },
  butter: { category: 'dairy', art: 'butter', detail: 'Refrigerated dairy' },
  cheese: { category: 'dairy', art: 'cheese', detail: 'Refrigerated dairy' },
  cheddar_cheese: { category: 'dairy', art: 'cheese', detail: 'Cheddar cheese' },
  chicken: { category: 'protein', art: 'chicken', detail: 'Protein' },
  beef: { category: 'protein', art: 'beef', detail: 'Protein' },
  rice: { category: 'dry pantry', art: 'rice', detail: 'Dry pantry' },
  pasta: { category: 'dry pantry', art: 'pasta', detail: 'Dry pantry' },
  bread: { category: 'dry pantry', art: 'bread', detail: 'Bakery' },
  all_purpose_flour: {
    category: 'dry pantry',
    art: 'flour',
    detail: 'Baking staple',
  },
  sugar: { category: 'dry pantry', art: 'sugar', detail: 'Sweetener' },
  oats: { category: 'dry pantry', art: 'oats', detail: 'Cereal grain' },
  porridge_oats: { category: 'dry pantry', art: 'oats', detail: 'Rolled oats' },
  potato: { category: 'produce', art: 'potato', detail: 'Produce' },
  potatoes: { category: 'produce', art: 'potato', detail: 'Produce' },
  onion: { category: 'produce', art: 'onion', detail: 'Produce' },
  garlic: { category: 'produce', art: 'garlic', detail: 'Produce' },
  tomato: { category: 'produce', art: 'tomato', detail: 'Produce' },
  carrot: { category: 'produce', art: 'carrot', detail: 'Produce' },
  lemon: { category: 'produce', art: 'lemon', detail: 'Produce' },
  apple: { category: 'produce', art: 'apple', detail: 'Produce' },
  banana: { category: 'produce', art: 'banana', detail: 'Produce' },
  yogurt: { category: 'dairy', art: 'yogurt', detail: 'Yogurt' },
  olive_oil: { category: 'dry pantry', art: 'oil', detail: 'Cooking oil' },
  salt: { category: 'seasoning', art: 'salt', detail: 'Seasoning' },
  black_pepper: {
    category: 'seasoning',
    art: 'pepper',
    detail: 'Seasoning',
  },
};

const CATEGORY_FALLBACKS: Readonly<Record<IngredientCategory, IngredientPresentation>> = {
  produce: { category: 'produce', art: 'fallback', detail: 'Produce' },
  protein: { category: 'protein', art: 'fallback', detail: 'Protein' },
  dairy: { category: 'dairy', art: 'fallback', detail: 'Refrigerated dairy' },
  'dry pantry': {
    category: 'dry pantry',
    art: 'fallback',
    detail: 'Pantry item',
  },
  seasoning: {
    category: 'seasoning',
    art: 'fallback',
    detail: 'Seasoning',
  },
  ingredient: {
    category: 'ingredient',
    art: 'fallback',
    detail: 'Ingredient',
  },
};

for (const presentation of Object.values(COMMON_PRESENTATION)) {
  validateIngredientPresentation(presentation);
}
for (const presentation of Object.values(CATEGORY_FALLBACKS)) {
  validateIngredientPresentation(presentation);
}

export function getIngredientPresentation(id: IngredientId): IngredientPresentation {
  const presentation = COMMON_PRESENTATION[id] ?? CATEGORY_FALLBACKS.ingredient;
  return validateIngredientPresentation(presentation);
}

/** A conservative common starter set with broad bundled-recipe coverage. */
export const PANTRY_STARTER_IDS: readonly IngredientId[] = [
  'rice',
  'porridge_oats',
  'pasta',
  'all_purpose_flour',
  'olive_oil',
  'salt',
  'black_pepper',
].filter((id) => lookupIngredient(id) !== undefined);
