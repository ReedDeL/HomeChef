import { describe, expect, it } from 'vitest';
import { BUNDLED_CATALOG } from '@/data/catalog';
import { decide } from '@/engine/decide';
import { makePrefs } from '@/engine/__fixtures__';

const NEW_MICROWAVE_IDS = [
  'hc-mw-21',
  'hc-mw-22',
  'hc-mw-23',
  'hc-mw-24',
  'hc-mw-25',
  'hc-mw-26',
  'hc-mw-27',
] as const;

const newMicrowaveRecipes = BUNDLED_CATALOG.filter((recipe) =>
  NEW_MICROWAVE_IDS.includes(recipe.id as (typeof NEW_MICROWAVE_IDS)[number])
);

const microwavePrefs = makePrefs({ equipment: ['microwave'] });

describe('curated microwave meal coverage', () => {
  it('ships exactly the seven requested meals as microwave-only recipes', () => {
    expect(newMicrowaveRecipes.map((recipe) => recipe.id)).toEqual([...NEW_MICROWAVE_IDS]);
    for (const recipe of newMicrowaveRecipes) {
      expect(recipe.equipmentRequired).toEqual(['microwave']);
      expect(recipe.totalTimeMinutes).toBeGreaterThanOrEqual(3);
      expect(recipe.totalTimeMinutes).toBeLessThanOrEqual(10);
    }
  });

  it.each([
    ['hc-mw-21', ['pita_bread', 'tomato_sauce', 'mozzarella', 'sweetcorn', 'dried_oregano']],
    ['hc-mw-22', ['tortillas', 'refried_beans', 'cheddar_cheese', 'salsa']],
    ['hc-mw-23', ['egg', 'milk', 'tortillas', 'cheddar_cheese', 'salsa']],
    ['hc-mw-24', ['flour_tortilla', 'cheddar_cheese', 'salsa']],
    ['hc-mw-25', ['macaroni', 'water', 'milk', 'butter', 'cheddar_cheese']],
    ['hc-mw-26', ['russet_potato', 'butter', 'cheddar_cheese', 'salt', 'black_pepper']],
    ['hc-mw-27', ['rice', 'stir_fry_vegetables', 'soy_sauce', 'sesame_seed_oil']],
  ] as const)('returns %s in ready with its common staples', (id, pantry) => {
    const result = decide(newMicrowaveRecipes, new Set(pantry), microwavePrefs, 10);
    expect(result.buckets.ready.map((scored) => scored.recipe.id)).toContain(id);
  });

  it('returns an authentic meal in missing-one when one pantry staple is absent', () => {
    const result = decide(
      newMicrowaveRecipes,
      new Set(['tortillas', 'refried_beans', 'cheddar_cheese']),
      microwavePrefs,
      10
    );
    const burrito = result.buckets.missing_few.find((scored) => scored.recipe.id === 'hc-mw-22');
    expect(burrito?.missing).toEqual(['salsa']);
  });

  it('hard-filters non-microwave recipes for microwave-only users', () => {
    const stoveRecipe = BUNDLED_CATALOG.find((recipe) => recipe.id === 'hc-staple-grilled-cheese');
    expect(stoveRecipe?.equipmentRequired).toEqual(['stove']);

    const result = decide(
      [stoveRecipe!, ...newMicrowaveRecipes],
      new Set(['bread', 'cheddar_cheese', 'butter']),
      microwavePrefs,
      10
    );
    const allIds = Object.values(result.buckets)
      .flat()
      .map((scored) => scored.recipe.id);
    expect(allIds).not.toContain('hc-staple-grilled-cheese');
  });

  it('includes microwave egg safety guidance and no raw poultry or shell-egg directive', () => {
    const breakfast = newMicrowaveRecipes.find((recipe) => recipe.id === 'hc-mw-23');
    expect(breakfast?.instructions.toLowerCase()).toContain('beat');
    for (const recipe of newMicrowaveRecipes) {
      const instructions = recipe.instructions.toLowerCase();
      expect(instructions).not.toMatch(/raw (chicken|turkey|poultry)/);
      expect(instructions).not.toMatch(
        /(?:place|put|microwave|cook) (?:the )?egg in (?:its|the) shell/
      );
    }
  });
});
