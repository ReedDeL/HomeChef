import { describe, expect, it } from 'vitest';
import { toPantrySet, toUserPreferences } from '@/lib/adapters/from-database';
import { toRecipe, toCatalog } from '@/lib/adapters/to-recipe';
import { EQUIPMENT } from '@/engine/types';
import type { InventoryRow, MealFeedbackRow, UserPreferencesRow } from '@/types/database';

function inventoryRow(overrides: Partial<InventoryRow> = {}): InventoryRow {
  return {
    id: 'row-1',
    household_id: 'h1',
    ingredient_id: 'egg',
    quantity: 2,
    unit: null,
    purchased_on: null,
    source: 'manual',
    added_by: null,
    updated_at: '2026-08-03T00:00:00Z',
    ...overrides,
  };
}

function preferencesRow(overrides: Partial<UserPreferencesRow> = {}): UserPreferencesRow {
  return {
    user_id: 'u1',
    equipment: [],
    allergens: [],
    dietary: [],
    onboarding_done: false,
    updated_at: '2026-08-03T00:00:00Z',
    ...overrides,
  };
}

describe('toPantrySet', () => {
  it('reads ingredient_id and nothing else', () => {
    const set = toPantrySet([inventoryRow({ ingredient_id: 'egg' })]);
    expect([...set]).toEqual(['egg']);
  });

  it('returns an empty set for an empty inventory', () => {
    expect(toPantrySet([]).size).toBe(0);
  });

  it('collapses duplicate ingredient ids', () => {
    const set = toPantrySet([inventoryRow({ id: 'a' }), inventoryRow({ id: 'b' })]);
    expect(set.size).toBe(1);
  });

  // Deliberate: the engine asks "do you have it", not "how much".
  // A zero-quantity row is still a row the user has not deleted.
  it('counts a zero-quantity row as present', () => {
    expect(toPantrySet([inventoryRow({ quantity: 0 })]).has('egg')).toBe(true);
  });

  it('counts a null-quantity row as present', () => {
    expect(toPantrySet([inventoryRow({ quantity: null })]).has('egg')).toBe(true);
  });
});

describe('toUserPreferences', () => {
  it('maps the array columns straight through', () => {
    const prefs = toUserPreferences(
      preferencesRow({ equipment: ['microwave'], allergens: ['nut'], dietary: ['vegan'] }),
      []
    );
    expect(prefs.equipment).toEqual(['microwave']);
    expect(prefs.allergens).toEqual(['nut']);
    expect(prefs.dietary).toEqual(['vegan']);
  });

  it('yields empty arrays, never undefined, for a fresh row', () => {
    const prefs = toUserPreferences(preferencesRow(), []);
    expect(prefs.equipment).toEqual([]);
    expect(prefs.allergens).toEqual([]);
    expect(prefs.dietary).toEqual([]);
    expect(prefs.dislikedRecipeIds.size).toBe(0);
    expect(prefs.skippedRecipeIds.size).toBe(0);
  });

  it('yields safe defaults when the preferences row is missing entirely', () => {
    const prefs = toUserPreferences(null, []);
    expect(prefs.equipment).toEqual([]);
    expect(prefs.allergens).toEqual([]);
  });

  it('drops an equipment value outside the closed enum', () => {
    // Guards against a stale client writing a value the engine has no case for.
    const prefs = toUserPreferences(
      preferencesRow({ equipment: ['microwave', 'sous_vide', 'air-fryer'] }),
      []
    );
    expect(prefs.equipment).toEqual(['microwave']);
    for (const item of prefs.equipment) {
      expect(EQUIPMENT).toContain(item);
    }
  });

  it('drops a dietary value outside the closed enum', () => {
    const prefs = toUserPreferences(preferencesRow({ dietary: ['vegan', 'paleo'] }), []);
    expect(prefs.dietary).toEqual(['vegan']);
  });

  // disliked and skipped are different strengths of signal and must not merge.
  it('separates disliked from skipped verdicts', () => {
    const feedback: MealFeedbackRow[] = [
      feedbackRow('r1', 'disliked'),
      feedbackRow('r2', 'skipped'),
      feedbackRow('r3', 'liked'),
    ];
    const prefs = toUserPreferences(preferencesRow(), feedback);

    expect([...prefs.dislikedRecipeIds]).toEqual(['r1']);
    expect([...prefs.skippedRecipeIds]).toEqual(['r2']);
  });

  it('does not treat a liked recipe as a negative signal', () => {
    const prefs = toUserPreferences(preferencesRow(), [feedbackRow('r3', 'liked')]);
    expect(prefs.dislikedRecipeIds.has('r3')).toBe(false);
    expect(prefs.skippedRecipeIds.has('r3')).toBe(false);
  });

  it('defaults preferredCuisine to null', () => {
    expect(toUserPreferences(preferencesRow(), []).preferredCuisine).toBeNull();
  });
});

describe('toRecipe', () => {
  const raw = {
    id: '52959',
    title: 'Baked Eggs',
    imageUrl: null,
    cuisine: 'american',
    totalTimeMinutes: 15,
    equipmentRequired: ['oven'],
    dietaryTags: ['vegetarian'],
    ingredients: [{ id: 'egg', measure: '2', allergenGroups: ['egg'] }],
    instructions: 'Bake.',
    source: 'tier1',
  };

  it('maps a well-formed bundled record', () => {
    const recipe = toRecipe(raw);
    expect(recipe).not.toBeNull();
    expect(recipe?.id).toBe('52959');
    expect(recipe?.ingredients[0]?.allergenGroups).toEqual(['egg']);
  });

  it('defaults allergenGroups to an empty array when absent', () => {
    const recipe = toRecipe({ ...raw, ingredients: [{ id: 'egg', measure: '2' }] });
    expect(recipe?.ingredients[0]?.allergenGroups).toEqual([]);
  });

  it('drops equipment outside the closed enum rather than passing it through', () => {
    const recipe = toRecipe({ ...raw, equipmentRequired: ['oven', 'sous_vide'] });
    expect(recipe?.equipmentRequired).toEqual(['oven']);
  });

  it('falls back to "none" when no valid equipment survives', () => {
    const recipe = toRecipe({ ...raw, equipmentRequired: ['sous_vide'] });
    expect(recipe?.equipmentRequired).toEqual(['none']);
  });

  it('returns null for a record missing required fields', () => {
    expect(toRecipe({ title: 'no id' })).toBeNull();
    expect(toRecipe(null)).toBeNull();
    expect(toRecipe('not an object')).toBeNull();
  });

  it('returns null for a record with no ingredients', () => {
    expect(toRecipe({ ...raw, ingredients: [] })).toBeNull();
  });

  it('coerces a non-positive time to a usable default', () => {
    expect(toRecipe({ ...raw, totalTimeMinutes: 0 })?.totalTimeMinutes).toBeGreaterThan(0);
  });
});

describe('toCatalog', () => {
  it('skips malformed records instead of throwing', () => {
    const catalog = toCatalog([
      { id: 'ok', title: 'Fine', totalTimeMinutes: 10, ingredients: [{ id: 'egg' }] },
      { title: 'broken' },
      null,
    ]);
    expect(catalog.map((r) => r.id)).toEqual(['ok']);
  });

  it('returns an empty array for non-array input', () => {
    expect(toCatalog('nope')).toEqual([]);
    expect(toCatalog(null)).toEqual([]);
  });
});

function feedbackRow(recipeId: string, verdict: MealFeedbackRow['verdict']): MealFeedbackRow {
  return {
    user_id: 'u1',
    recipe_id: recipeId,
    verdict,
    made_on: null,
    created_at: '2026-08-03T00:00:00Z',
  };
}
