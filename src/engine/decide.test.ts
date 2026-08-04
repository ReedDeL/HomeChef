import { describe, expect, it } from 'vitest';
import { decide } from '@/engine/decide';
import {
  ALL_EQUIPMENT,
  ingredient,
  makePrefs,
  makeRecipe,
  makeRecipeWithIngredients,
  pantry,
} from '@/engine/__fixtures__';

describe('decide — hard constraints eliminate', () => {
  it('removes a recipe needing equipment the user lacks', () => {
    const catalog = [
      makeRecipe({ id: 'oven', equipmentRequired: ['oven'] }),
      makeRecipe({ id: 'micro', equipmentRequired: ['microwave'] }),
    ];
    const result = decide(
      catalog,
      pantry('egg', 'salt'),
      makePrefs({ equipment: ['microwave'] }),
      30
    );
    expect(flatIds(result)).toEqual(['micro']);
  });

  it('removes a recipe containing a declared allergen', () => {
    const catalog = [
      makeRecipe({ id: 'has-egg', ingredients: [ingredient('egg')] }),
      makeRecipe({ id: 'safe', ingredients: [ingredient('rice')] }),
    ];
    const result = decide(catalog, pantry('egg', 'rice'), makePrefs({ allergens: ['egg'] }), 30);
    expect(flatIds(result)).toEqual(['safe']);
  });

  it('removes a recipe over the time limit', () => {
    const catalog = [
      makeRecipe({ id: 'slow', totalTimeMinutes: 45 }),
      makeRecipe({ id: 'quick', totalTimeMinutes: 20 }),
    ];
    const result = decide(catalog, pantry('egg', 'salt'), makePrefs(), 20);
    expect(flatIds(result)).toEqual(['quick']);
  });

  it('removes a disliked recipe entirely', () => {
    const catalog = [makeRecipe({ id: 'nope' }), makeRecipe({ id: 'yes' })];
    const result = decide(
      catalog,
      pantry('egg', 'salt'),
      makePrefs({ dislikedRecipeIds: new Set(['nope']) }),
      30
    );
    expect(flatIds(result)).toEqual(['yes']);
  });
});

describe('decide — bucketing and truncation', () => {
  it('places recipes by missing count', () => {
    const catalog = [
      makeRecipeWithIngredients(2, { id: 'ready' }),
      makeRecipeWithIngredients(3, { id: 'few' }),
      makeRecipeWithIngredients(5, { id: 'some' }),
      makeRecipeWithIngredients(8, { id: 'grocery' }),
    ];
    // Pantry holds i0 and i1, so missing counts are 0, 1, 3 and 6.
    const result = decide(catalog, pantry('i0', 'i1'), makePrefs(), 30);

    expect(result.buckets.ready.map((s) => s.recipe.id)).toEqual(['ready']);
    expect(result.buckets.missing_few.map((s) => s.recipe.id)).toEqual(['few']);
    expect(result.buckets.missing_some.map((s) => s.recipe.id)).toEqual(['some']);
    expect(result.buckets.grocery_run.map((s) => s.recipe.id)).toEqual(['grocery']);
  });

  it('caps each bucket at 4 even with 9 qualifying recipes', () => {
    const catalog = Array.from({ length: 9 }, (_, i) =>
      makeRecipe({ id: `r${i}`, ingredients: [ingredient('egg')] })
    );
    const result = decide(catalog, pantry('egg'), makePrefs(), 30);
    expect(result.buckets.ready).toHaveLength(4);
  });

  it('keeps the highest-scoring recipes when truncating', () => {
    // Identical except for time: the fastest four must survive.
    const catalog = Array.from({ length: 9 }, (_, i) =>
      makeRecipe({ id: `t${i}`, totalTimeMinutes: i + 1, ingredients: [ingredient('egg')] })
    );
    const result = decide(catalog, pantry('egg'), makePrefs(), 30);
    expect(result.buckets.ready.map((s) => s.recipe.id)).toEqual(['t0', 't1', 't2', 't3']);
  });

  it('sorts by score descending within a bucket', () => {
    const catalog = Array.from({ length: 4 }, (_, i) =>
      makeRecipe({ id: `s${i}`, totalTimeMinutes: 20 - i, ingredients: [ingredient('egg')] })
    );
    const scores = decide(catalog, pantry('egg'), makePrefs(), 30).buckets.ready.map(
      (s) => s.score
    );
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('breaks ties stably by recipe id so the UI does not reshuffle', () => {
    const catalog = [
      makeRecipe({ id: 'b', ingredients: [ingredient('egg')] }),
      makeRecipe({ id: 'a', ingredients: [ingredient('egg')] }),
      makeRecipe({ id: 'c', ingredients: [ingredient('egg')] }),
    ];
    const first = decide(catalog, pantry('egg'), makePrefs(), 30);
    const second = decide([...catalog].reverse(), pantry('egg'), makePrefs(), 30);
    expect(first.buckets.ready.map((s) => s.recipe.id)).toEqual(['a', 'b', 'c']);
    expect(second.buckets.ready.map((s) => s.recipe.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not put a zero-ingredient recipe in ready', () => {
    const result = decide([makeRecipe({ ingredients: [] })], pantry(), makePrefs(), 30);
    expect(result.buckets.ready).toHaveLength(0);
  });

  it('returns four empty buckets, not undefined, for an empty catalog', () => {
    const result = decide([], pantry(), makePrefs(), 30);
    expect(result.buckets).toEqual({
      ready: [],
      missing_few: [],
      missing_some: [],
      grocery_run: [],
    });
    expect(result.appliedRelaxations).toEqual([]);
  });
});

describe('decide — purity', () => {
  it('does not mutate its inputs', () => {
    const catalog = [makeRecipeWithIngredients(3)];
    const snapshot = structuredClone(catalog);
    const prefs = makePrefs({ equipment: [...ALL_EQUIPMENT] });
    const pantrySet = pantry('i0');

    decide(catalog, pantrySet, prefs, 30);

    expect(catalog).toEqual(snapshot);
    expect([...pantrySet]).toEqual(['i0']);
    expect(prefs.equipment).toEqual(ALL_EQUIPMENT);
  });
});

function flatIds(result: ReturnType<typeof decide>): string[] {
  return Object.values(result.buckets)
    .flat()
    .map((s) => s.recipe.id)
    .sort();
}
