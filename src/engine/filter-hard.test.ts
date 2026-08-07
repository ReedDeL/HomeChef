import { describe, expect, it } from 'vitest';
import { hasAllergen, isEquipmentSatisfied, satisfiesDietary } from '@/engine/filter-hard';
import { ALL_EQUIPMENT, ingredient, makeRecipe } from '@/engine/__fixtures__';
import type { Equipment } from '@/engine/types';

describe('isEquipmentSatisfied', () => {
  it('survives when every required item is owned', () => {
    expect(isEquipmentSatisfied(['microwave', 'kettle'], ['microwave', 'kettle', 'oven'])).toBe(
      true
    );
  });

  it('is filtered when one required item is missing', () => {
    expect(isEquipmentSatisfied(['microwave', 'oven'], ['microwave'])).toBe(false);
  });

  // Boundary: the dorm-room user who owns nothing.
  it('filters everything except "none" when the user owns nothing', () => {
    expect(isEquipmentSatisfied(['microwave'], [])).toBe(false);
    expect(isEquipmentSatisfied(['none'], [])).toBe(true);
  });

  // Boundary: the full-kitchen user.
  it('admits everything when the user owns everything', () => {
    expect(isEquipmentSatisfied(['oven', 'stove', 'blender'], ALL_EQUIPMENT)).toBe(true);
  });

  it('treats "none" as always satisfied even alongside real equipment', () => {
    expect(isEquipmentSatisfied(['none', 'microwave'], ['microwave'])).toBe(true);
    expect(isEquipmentSatisfied(['none', 'oven'], ['microwave'])).toBe(false);
  });

  it('admits a recipe that requires nothing at all', () => {
    expect(isEquipmentSatisfied([], [])).toBe(true);
  });

  // The microwave-wedge regression. `unclassified` means tagging failed, so the
  // recipe is excluded from everyone until enrichment classifies it. Treating
  // it like `none` is what served 76 stove recipes to microwave-only users.
  describe('"unclassified" is never satisfied', () => {
    it('is filtered for the full-kitchen user', () => {
      expect(isEquipmentSatisfied(['unclassified'], ALL_EQUIPMENT)).toBe(false);
    });

    it('is filtered for the microwave-only user', () => {
      expect(isEquipmentSatisfied(['unclassified'], ['microwave'])).toBe(false);
    });

    // Defence in depth: no UI should ever put `unclassified` in an owned set,
    // but if one did, the recipe must still not become satisfiable.
    it('is filtered even when the owned set literally contains it', () => {
      expect(isEquipmentSatisfied(['unclassified'], ['unclassified'])).toBe(false);
    });

    it('poisons an otherwise satisfiable requirement list', () => {
      expect(isEquipmentSatisfied(['microwave', 'unclassified'], ALL_EQUIPMENT)).toBe(false);
    });

    it('is not rescued by an accompanying "none"', () => {
      expect(isEquipmentSatisfied(['none', 'unclassified'], ALL_EQUIPMENT)).toBe(false);
    });
  });

  // The other half of the contract: narrowing `unclassified` must not have
  // narrowed `none`, which stays a verified claim and stays always satisfied.
  it('keeps "none" satisfied by every possible equipment set', () => {
    const equipmentSets: Equipment[][] = [[], ['microwave'], [...ALL_EQUIPMENT]];
    for (const owned of equipmentSets) {
      expect(isEquipmentSatisfied(['none'], owned)).toBe(true);
    }
  });
});

describe('hasAllergen', () => {
  it('flags a direct canonical id match', () => {
    const recipe = makeRecipe({ ingredients: [ingredient('egg'), ingredient('flour')] });
    expect(hasAllergen(recipe, ['egg'])).toBe(true);
  });

  // The regression that matters. Substring matching -- the bug in the prior
  // implementation -- would exclude eggplant for an "egg" allergy.
  it('does NOT flag eggplant for an egg allergy', () => {
    const recipe = makeRecipe({ ingredients: [ingredient('eggplant'), ingredient('olive_oil')] });
    expect(hasAllergen(recipe, ['egg'])).toBe(false);
  });

  it('does NOT flag coconut or butternut_squash for a nut allergy', () => {
    const recipe = makeRecipe({
      ingredients: [ingredient('coconut'), ingredient('butternut_squash')],
    });
    expect(hasAllergen(recipe, ['nut'])).toBe(false);
  });

  it('flags via allergen group, so butter triggers a dairy allergy', () => {
    const recipe = makeRecipe({ ingredients: [ingredient('butter', ['dairy'])] });
    expect(hasAllergen(recipe, ['dairy'])).toBe(true);
  });

  it('flags a peanut ingredient for a declared nut group', () => {
    const recipe = makeRecipe({ ingredients: [ingredient('peanut', ['nut', 'legume'])] });
    expect(hasAllergen(recipe, ['nut'])).toBe(true);
  });

  it('excludes nothing when the allergen list is empty', () => {
    const recipe = makeRecipe({ ingredients: [ingredient('peanut', ['nut'])] });
    expect(hasAllergen(recipe, [])).toBe(false);
  });

  it('handles a recipe with no ingredients', () => {
    expect(hasAllergen(makeRecipe({ ingredients: [] }), ['egg'])).toBe(false);
  });
});

describe('satisfiesDietary', () => {
  it('admits everything when no restriction is selected', () => {
    expect(satisfiesDietary(makeRecipe({ dietaryTags: [] }), [])).toBe(true);
  });

  // Pinned decision: dietary selections are restrictions, so they AND together.
  // Selecting vegan + gluten_free requires a recipe tagged BOTH, not either.
  it('requires every selected restriction to be satisfied (AND, not OR)', () => {
    const both = makeRecipe({ dietaryTags: ['vegan', 'gluten_free'] });
    const onlyVegan = makeRecipe({ dietaryTags: ['vegan'] });

    expect(satisfiesDietary(both, ['vegan', 'gluten_free'])).toBe(true);
    expect(satisfiesDietary(onlyVegan, ['vegan', 'gluten_free'])).toBe(false);
  });

  it('filters an untagged recipe when any restriction is selected', () => {
    expect(satisfiesDietary(makeRecipe({ dietaryTags: [] }), ['vegetarian'])).toBe(false);
  });
});
