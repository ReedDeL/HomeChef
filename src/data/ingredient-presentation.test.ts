import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import {
  getIngredientPresentation,
  PANTRY_STARTER_IDS,
  validateIngredientPresentation,
} from '@/data/ingredient-presentation';
import { toMealSlots } from '@/lib/adapters/to-recipe';

describe('ingredient presentation boundary', () => {
  it('uses a bundled image for every starter item and an existing local fallback', () => {
    for (const id of [...PANTRY_STARTER_IDS, 'unknown_ingredient']) {
      const presentation = getIngredientPresentation(id);
      expect(
        existsSync(new URL(`../../assets/ingredient-art/${presentation.art}.png`, import.meta.url))
      ).toBe(true);
      if (id !== 'unknown_ingredient') expect(presentation.art).not.toBe('fallback');
    }
  });
  it('does not guess categories from substrings', () => {
    for (const id of ['coconut_milk', 'eggplant', 'peanut_butter']) {
      expect(getIngredientPresentation(id).detail).toBe('Ingredient');
    }
    expect(() =>
      validateIngredientPresentation({ category: 'produce', art: 'invented', detail: 'Produce' })
    ).toThrow();
  });
});
describe('meal suitability boundary', () => {
  it('does not make unknown recipes or desserts eligible for every meal', () => {
    expect(toMealSlots({ id: 'unknown' })).toEqual([]);
    expect(toMealSlots({ id: 'hc-mw-01', mealSlots: [] })).toEqual([]);
    expect(toMealSlots({ id: 'unknown', mealSlots: ['snack'] })).toEqual([]);
  });
  it('accepts explicit all-day metadata and canonicalizes order', () => {
    expect(toMealSlots({ mealSlots: ['dinner', 'breakfast', 'lunch', 'breakfast'] })).toEqual([
      'breakfast',
      'lunch',
      'dinner',
    ]);
  });
});
