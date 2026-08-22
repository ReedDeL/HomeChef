import { describe, expect, it } from 'vitest';

import { hasAllergen } from '@/engine/filter-hard';
import type { Recipe } from '@/engine/types';
import {
  COMMON_ALLERGENS,
  EQUIPMENT_TIERS,
  toEnginePreferences,
  useKitchenStore,
} from '@/store/kitchen';
import { INGREDIENT_VOCABULARY } from '@/data/catalog';

type Constraints = Parameters<typeof toEnginePreferences>[0];

const base: Constraints = { tierId: 'full', extras: [], allergens: [], dietary: [] };

describe('toEnginePreferences', () => {
  it('unions the tier equipment with the extra appliances', () => {
    const prefs = toEnginePreferences({ ...base, tierId: 'microwave', extras: ['air_fryer'] });

    expect(prefs.equipment).toContain('microwave');
    expect(prefs.equipment).toContain('air_fryer');
    expect(prefs.equipment).not.toContain('stove');
  });

  it('does not duplicate an appliance already granted by the tier', () => {
    const prefs = toEnginePreferences({ ...base, tierId: 'full', extras: ['stove'] });

    expect(prefs.equipment.filter((item) => item === 'stove')).toHaveLength(1);
  });

  it('falls back to no equipment when the stored tier no longer exists', () => {
    // A renamed tier must not silently grant a full kitchen.
    const prefs = toEnginePreferences({ ...base, tierId: 'tier-that-was-removed' });

    expect(prefs.equipment).toEqual([]);
  });

  it('expands an allergen option into every vocabulary group it covers', () => {
    const prefs = toEnginePreferences({ ...base, allergens: ['gluten'] });

    // "Gluten" has to cover the `wheat` group too, or half the offending
    // ingredients slip through.
    expect(prefs.allergens).toContain('gluten');
    expect(prefs.allergens).toContain('wheat');
  });

  it('expands tree nuts to both nut groups', () => {
    const prefs = toEnginePreferences({ ...base, allergens: ['tree_nut'] });

    expect(prefs.allergens).toEqual(expect.arrayContaining(['nut', 'tree_nut']));
  });

  it('ignores an unknown allergen id rather than passing it through', () => {
    const prefs = toEnginePreferences({ ...base, allergens: ['not-an-allergen'] });

    expect(prefs.allergens).toEqual([]);
  });

  it('passes the cuisine through as a soft preference', () => {
    expect(toEnginePreferences(base, 'italian').preferredCuisine).toBe('italian');
    expect(toEnginePreferences(base).preferredCuisine).toBeNull();
  });
});

describe('COMMON_ALLERGENS', () => {
  /**
   * The safety-critical property. An allergen offered in the UI that matches
   * nothing in the vocabulary is worse than an omitted one: the user believes
   * they are protected and they are not.
   */
  it('only offers allergens whose groups exist in the ingredient vocabulary', () => {
    const known = new Set(INGREDIENT_VOCABULARY.flatMap((entry) => entry.allergenGroups));

    for (const allergen of COMMON_ALLERGENS) {
      for (const group of allergen.groups) {
        expect(known, `${allergen.label} declares unknown group "${group}"`).toContain(group);
      }
    }
  });

  it('actually excludes a recipe once expanded through the engine filter', () => {
    const dairyIngredient = INGREDIENT_VOCABULARY.find((entry) =>
      entry.allergenGroups.includes('dairy')
    );
    expect(dairyIngredient).toBeDefined();

    const recipe: Recipe = {
      id: 'r1',
      title: 'Buttered something',
      imageUrl: null,
      cuisine: null,
      totalTimeMinutes: 10,
      equipmentRequired: ['none'],
      dietaryTags: [],
      ingredients: [
        {
          id: dairyIngredient!.id,
          measure: '1 tbsp',
          allergenGroups: dairyIngredient!.allergenGroups,
        },
      ],
      instructions: 'Melt it.',
    };

    const prefs = toEnginePreferences({ ...base, allergens: ['dairy'] });
    expect(hasAllergen(recipe, prefs.allergens)).toBe(true);
  });
});

describe('EQUIPMENT_TIERS', () => {
  it('never offers the unclassified sentinel as something a user can own', () => {
    for (const tier of EQUIPMENT_TIERS) {
      expect(tier.equipment).not.toContain('unclassified');
    }
  });
});

describe('useKitchenStore themeMode', () => {
  it('defaults to system theme mode and updates on setThemeMode', () => {
    expect(useKitchenStore.getState().themeMode).toBe('system');

    useKitchenStore.getState().setThemeMode('dark');
    expect(useKitchenStore.getState().themeMode).toBe('dark');

    useKitchenStore.getState().setThemeMode('light');
    expect(useKitchenStore.getState().themeMode).toBe('light');

    useKitchenStore.getState().setThemeMode('system');
    expect(useKitchenStore.getState().themeMode).toBe('system');
  });
});

describe('useKitchenStore step navigation state retention', () => {
  it('remembers selections when moving backwards and forwards between steps', () => {
    // Step 1: Equipment
    useKitchenStore.getState().setTier('microwave');
    useKitchenStore.getState().toggleExtra('air_fryer');

    // Step 2: Restrictions
    useKitchenStore.getState().toggleAllergen('peanut');
    useKitchenStore.getState().toggleDietary('vegetarian');

    // Step 3: Staples
    useKitchenStore.getState().togglePantryItem('rice');

    // Simulate navigating back to Step 1 (Equipment)
    // Selections from Step 2 and Step 3 must NOT be lost
    expect(useKitchenStore.getState().tierId).toBe('microwave');
    expect(useKitchenStore.getState().extras).toContain('air_fryer');
    expect(useKitchenStore.getState().allergens).toContain('peanut');
    expect(useKitchenStore.getState().dietary).toContain('vegetarian');
    expect(useKitchenStore.getState().pantry).toContain('rice');

    // Adjusting Step 1 preserves downstream choices
    useKitchenStore.getState().setTier('full');
    expect(useKitchenStore.getState().allergens).toContain('peanut');
    expect(useKitchenStore.getState().dietary).toContain('vegetarian');
  });
});
