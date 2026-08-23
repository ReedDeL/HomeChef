import { describe, expect, it } from 'vitest';
import recipesJson from '@/data/recipes.json';
import { INGREDIENT_VOCABULARY, BUNDLED_CATALOG, lookupIngredient } from '@/data/catalog';
import { decideWithRelaxation } from '@/engine/relax';
import { EQUIPMENT } from '@/engine/types';

/**
 * Contract tests over the REAL generated catalog, not fixtures.
 *
 * The pipeline is Python and the engine is TypeScript, so nothing but a test
 * like this catches the two drifting apart. A pipeline change that emits a
 * value the engine cannot read fails here rather than at 6pm on a user's phone.
 */
describe('bundled catalog', () => {
  it('is not empty', () => {
    expect(BUNDLED_CATALOG.length).toBeGreaterThan(0);
  });

  it('survives adapter parsing without dropping records', () => {
    // toCatalog silently skips malformed entries, so a shortfall here means
    // the generator emitted something the adapter rejected.
    expect(BUNDLED_CATALOG.length).toBeGreaterThan(20);
  });

  it('has a unique id for every recipe', () => {
    const ids = BUNDLED_CATALOG.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only equipment values inside the closed enum', () => {
    for (const recipe of BUNDLED_CATALOG) {
      expect(recipe.equipmentRequired.length).toBeGreaterThan(0);
      for (const item of recipe.equipmentRequired) {
        expect(EQUIPMENT).toContain(item);
      }
    }
  });

  it('gives every recipe a positive cook time', () => {
    for (const recipe of BUNDLED_CATALOG) {
      expect(recipe.totalTimeMinutes).toBeGreaterThan(0);
    }
  });

  it('gives every recipe at least one ingredient', () => {
    for (const recipe of BUNDLED_CATALOG) {
      expect(recipe.ingredients.length).toBeGreaterThan(0);
    }
  });

  it('gives every recipe explicit safe nutrition fields', () => {
    for (const raw of recipesJson) {
      for (const key of [
        'baseServings',
        'energyKcalPerServing',
        'nutritionProvenance',
        'nutritionConfidence',
      ]) {
        expect(Object.hasOwn(raw, key)).toBe(true);
      }
    }
    for (const recipe of BUNDLED_CATALOG) {
      if (recipe.nutritionConfidence === 'low' || recipe.nutritionConfidence === 'unavailable') {
        expect(recipe.energyKcalPerServing).toBeNull();
      }
    }
  });

  it('references only ingredients present in the vocabulary', () => {
    // The pantry set-difference is a lookup by id. An ingredient a recipe needs
    // but the vocabulary does not know is unreachable from the pantry forever.
    const missing = new Set<string>();
    for (const recipe of BUNDLED_CATALOG) {
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

/**
 * The microwave-only user is the wedge (docs/superpowers/specs/
 * 2026-08-06-microwave-seed-catalog-design.md). TheMealDB supplies exactly two
 * microwave-only recipes and both are 240-minute fudge, which the time ladder
 * cannot reach — so without the hand-curated seed this user sees nothing at all.
 */
describe('microwave coverage', () => {
  const microwaveOnly = BUNDLED_CATALOG.filter(
    (r) => r.equipmentRequired.length === 1 && r.equipmentRequired[0] === 'microwave'
  );

  it('carries at least 20 recipes that require a microwave', () => {
    const requiring = BUNDLED_CATALOG.filter((r) => r.equipmentRequired.includes('microwave'));
    expect(requiring.length).toBeGreaterThanOrEqual(20);
  });

  it('keeps the hand-curated seed in the built catalog', () => {
    // The build merges tools/catalog/seed/*.json. If a rebuild ever drops the
    // merge step, src/data/ is regenerated without it and this is the only
    // thing that notices.
    const seeded = BUNDLED_CATALOG.filter((r) => r.id.startsWith('hc-mw-'));
    expect(seeded.length).toBe(20);
  });

  it('gives the microwave-only user recipes reachable within an hour', () => {
    const reachable = microwaveOnly.filter((r) => r.totalTimeMinutes <= 60);
    expect(reachable.length).toBeGreaterThanOrEqual(20);
  });

  it('serves a microwave-only user with a realistic pantry', () => {
    const result = decideWithRelaxation(
      BUNDLED_CATALOG,
      new Set(['egg', 'milk', 'butter', 'salt', 'onion', 'garlic']),
      {
        equipment: ['microwave'],
        allergens: [],
        dietary: [],
        dislikedRecipeIds: new Set(),
        skippedRecipeIds: new Set(),
        preferredCuisine: null,
      },
      15
    );

    expect(Object.values(result.buckets).flat().length).toBeGreaterThan(0);
  });

  // The regression this whole change exists to prevent. Before it, the 76
  // unclassified recipes were tagged `none`, which the equipment filter treats
  // as always satisfied — so they were served to microwave-only users as though
  // verified. Nothing in the catalog may claim `none` unless it was earned.
  it('no longer ships recipes tagged "none" by the keyword fallback', () => {
    const claimingNone = BUNDLED_CATALOG.filter((r) => r.equipmentRequired.includes('none'));
    expect(claimingNone).toEqual([]);
  });

  it('marks unclassified recipes honestly instead of as no-equipment', () => {
    const unclassified = BUNDLED_CATALOG.filter((r) =>
      r.equipmentRequired.includes('unclassified')
    );
    // A backlog, not a statistic: these are excluded from every user's results
    // until the enrichment pass classifies them.
    expect(unclassified.length).toBeGreaterThan(0);
    for (const recipe of unclassified) {
      expect(recipe.equipmentRequired).toEqual(['unclassified']);
    }
  });
});

describe('the real catalog never yields an empty screen', () => {
  const pantry = new Set(['egg', 'milk', 'butter', 'salt', 'onion', 'garlic']);

  for (const equipment of [['microwave'], ['microwave', 'kettle'], ['stove', 'oven']] as const) {
    for (const timeLimit of [15, 30, 60]) {
      it(`returns something for ${equipment.join('+')} at ${timeLimit} min`, () => {
        const result = decideWithRelaxation(
          BUNDLED_CATALOG,
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
