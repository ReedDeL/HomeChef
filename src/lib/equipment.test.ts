import { describe, expect, it } from 'vitest';

import {
  EQUIPMENT_CHECKLIST_OPTIONS,
  migrateEquipmentState,
  normalizeOwnedEquipment,
  toggleOwnedEquipment,
} from '@/lib/equipment';

describe('equipment checklist model', () => {
  it('exposes the complete ordered checklist without the engine sentinel', () => {
    expect(EQUIPMENT_CHECKLIST_OPTIONS.map((option) => option.label)).toEqual([
      'Microwave',
      'Stovetop',
      'Oven',
      'Electric kettle',
      'Air fryer',
      'Rice cooker',
      'Blender',
      'Toaster oven',
      'No cooking equipment',
    ]);
    expect(EQUIPMENT_CHECKLIST_OPTIONS.map((option) => option.id)).not.toContain('unclassified');
  });

  it('makes no equipment mutually exclusive with every appliance', () => {
    expect(toggleOwnedEquipment(['microwave', 'oven'], 'none')).toEqual(['none']);
    expect(toggleOwnedEquipment(['none'], 'oven')).toEqual(['oven']);
    expect(toggleOwnedEquipment(['none'], 'none')).toEqual([]);
  });

  it('toggles appliances independently and removes duplicates and unknown values', () => {
    expect(toggleOwnedEquipment(['microwave'], 'oven')).toEqual(['microwave', 'oven']);
    expect(toggleOwnedEquipment(['microwave', 'oven'], 'microwave')).toEqual(['oven']);
    expect(normalizeOwnedEquipment(['microwave', 'microwave', 'sous_vide'])).toEqual(['microwave']);
  });
});

describe('equipment persistence migration', () => {
  it.each([
    ['microwave', ['microwave']],
    ['kettle', ['microwave', 'kettle']],
    ['full', ['microwave', 'stove', 'oven', 'kettle']],
  ] as const)('expands the legacy %s tier', (tierId, expected) => {
    expect(migrateEquipmentState({ tierId, extras: [] }).equipment).toEqual(expected);
  });

  it('merges legacy extras and preserves all unrelated state', () => {
    const weeklyPlan = { status: 'confirmed', entries: [{ recipeId: 'r1' }] };
    const migrated = migrateEquipmentState({
      tierId: 'kettle',
      extras: ['air_fryer', 'kettle', 'unclassified'],
      pantry: ['rice'],
      allergens: ['peanut'],
      dietary: ['vegan'],
      weeklyPlan,
      mealPrepRemindersEnabled: true,
      dislikedRecipes: ['r2'],
    });

    expect(migrated.equipment).toEqual(['microwave', 'kettle', 'air_fryer']);
    expect(migrated).not.toHaveProperty('tierId');
    expect(migrated).not.toHaveProperty('extras');
    expect(migrated).toMatchObject({
      pantry: ['rice'],
      allergens: ['peanut'],
      dietary: ['vegan'],
      weeklyPlan,
      mealPrepRemindersEnabled: true,
      dislikedRecipes: ['r2'],
    });
  });

  it('keeps explicit no-equipment and an explicit empty selection distinct', () => {
    expect(migrateEquipmentState({ equipment: ['none'], tierId: 'full' }).equipment).toEqual([
      'none',
    ]);
    expect(migrateEquipmentState({ equipment: [], tierId: 'full' }).equipment).toEqual([]);
  });

  it('is idempotent', () => {
    const once = migrateEquipmentState({ tierId: 'full', extras: ['blender'], pantry: ['rice'] });
    expect(migrateEquipmentState(once)).toEqual(once);
  });
});
