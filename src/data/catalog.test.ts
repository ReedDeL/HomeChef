import { describe, expect, it } from 'vitest';
import { INGREDIENT_VOCABULARY, TIER1_CATALOG, lookupIngredient } from '@/data/catalog';
import { decideWithRelaxation } from '@/engine/relax';
import { EQUIPMENT } from '@/engine/types';

/**
 * Contract tests over the REAL generated catalog, not fixtures.
 *
 * The pipeline is Python and the engine is TypeScript, so nothing but a test
 * like this catches the two drifting apart. A pipeline change that emits a
 * value the engine cannot read fails here rather than at 6pm on a user's phone.
 */
describe('bundled Tier 1 catalog', () => {
  it('is not empty', () => {
    expect(TIER1_CATALOG.length).toBeGreaterThan(0);
  });

  it('survives adapter parsing without dropping records', () => {
    // toCatalog silently skips malformed entries, so a shortfall here means
    // the generator emitted something the adapter rejected.
    expect(TIER1_CATALOG.length).toBeGreaterThan(20);
  });

  it('has a unique id for every recipe', () => {
    const ids = TIER1_CATALOG.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only equipment values inside the closed enum', () => {
    for (const recipe of TIER1_CATALOG) {
      expect(recipe.equipmentRequired.length).toBeGreaterThan(0);
      for (const item of recipe.equipmentRequired) {
        expect(EQUIPMENT).toContain(item);
      }
    }
  });

  it('gives every recipe a positive cook time', () => {
    for (const recipe of TIER1_CATALOG) {
      expect(recipe.totalTimeMinutes).toBeGreaterThan(0);
    }
  });

  it('gives every recipe at least one ingredient', () => {
    for (const recipe of TIER1_CATALOG) {
      expect(recipe.ingredients.length).toBeGreaterThan(0);
    }
  });

  it('references only ingredients present in the vocabulary', () => {
    // The pantry set-difference is a lookup by id. An ingredient a recipe needs
    // but the vocabulary does not know is unreachable from the pantry forever.
    const missing = new Set<string>();
    for (const recipe of TIER1_CATALOG) {
      for (const ingredient of recipe.ingredients) {
        if (!lookupIngredient(ingredient.id)) missing.add(ingredient.id);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe('bundled ingredient vocabulary', () => {
  it('is not empty', () => {
    expect(INGREDIENT_VOCABULARY.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    const ids = INGREDIENT_VOCABULARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses no whitespace or uppercase in ids', () => {
    for (const entry of INGREDIENT_VOCABULARY) {
      expect(entry.id).toMatch(/^[a-z0-9_]+$/);
    }
  });
});

describe('the real catalog never yields an empty screen', () => {
  const pantry = new Set(['egg', 'milk', 'butter', 'salt', 'onion', 'garlic']);

  for (const equipment of [['microwave'], ['microwave', 'kettle'], ['stove', 'oven']] as const) {
    for (const timeLimit of [15, 30, 60]) {
      it(`returns something for ${equipment.join('+')} at ${timeLimit} min`, () => {
        const result = decideWithRelaxation(
          TIER1_CATALOG,
          pantry,
          {
            equipment: [...equipment],
            allergens: [],
            dietary: [],
            dislikedRecipeIds: new Set(),
            skippedRecipeIds: new Set(),
            preferredCuisine: null,
          },
          timeLimit
        );

        const total = Object.values(result.buckets).flat().length;
        expect(total).toBeGreaterThan(0);
      });
    }
  }
});
