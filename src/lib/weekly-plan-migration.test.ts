import { describe, expect, it } from 'vitest';

import type { WeeklyMealPlan } from '@/contracts/meal-journeys';
import { migrateWeeklyPlan } from '@/lib/weekly-plan-migration';

const DATES = [
  '2026-08-24',
  '2026-08-25',
  '2026-08-26',
  '2026-08-27',
  '2026-08-28',
  '2026-08-29',
  '2026-08-30',
];

describe('migrateWeeklyPlan', () => {
  it('returns null for null, undefined, or non-object input', () => {
    expect(migrateWeeklyPlan(null)).toBeNull();
    expect(migrateWeeklyPlan(undefined)).toBeNull();
    expect(migrateWeeklyPlan('invalid')).toBeNull();
    expect(migrateWeeklyPlan(123)).toBeNull();
    expect(migrateWeeklyPlan([])).toBeNull();
  });

  it('passes through an already valid v2 plan unchanged', () => {
    const v2Plan: WeeklyMealPlan = {
      weekStart: '2026-08-24',
      dayCount: 3,
      mealSlots: ['breakfast', 'lunch'],
      limitedVariety: false,
      status: 'draft',
      statedRelaxations: [],
      entries: [
        {
          kind: 'recipe',
          date: '2026-08-24',
          mealSlot: 'breakfast',
          recipeId: 'bundled-1',
          plannedMealTime: '2026-08-24T08:00:00+00:00',
          statedRelaxations: [],
          portionGuidance: null,
        },
        {
          kind: 'recipe',
          date: '2026-08-24',
          mealSlot: 'lunch',
          recipeId: 'bundled-2',
          plannedMealTime: '2026-08-24T12:00:00+00:00',
          statedRelaxations: [],
          portionGuidance: null,
        },
        {
          kind: 'recipe',
          date: '2026-08-25',
          mealSlot: 'breakfast',
          recipeId: 'bundled-1',
          plannedMealTime: '2026-08-25T08:00:00+00:00',
          statedRelaxations: [],
          portionGuidance: null,
        },
        {
          kind: 'recipe',
          date: '2026-08-25',
          mealSlot: 'lunch',
          recipeId: 'bundled-2',
          plannedMealTime: '2026-08-25T12:00:00+00:00',
          statedRelaxations: [],
          portionGuidance: null,
        },
        {
          kind: 'recipe',
          date: '2026-08-26',
          mealSlot: 'breakfast',
          recipeId: 'bundled-1',
          plannedMealTime: '2026-08-26T08:00:00+00:00',
          statedRelaxations: [],
          portionGuidance: null,
        },
        {
          kind: 'recipe',
          date: '2026-08-26',
          mealSlot: 'lunch',
          recipeId: 'bundled-2',
          plannedMealTime: '2026-08-26T12:00:00+00:00',
          statedRelaxations: [],
          portionGuidance: null,
        },
      ],
      groceryNeeds: [],
    };

    const migrated = migrateWeeklyPlan(v2Plan);
    expect(migrated).toEqual(v2Plan);
  });

  it('migrates a legacy v1 7-day dinner-only plan to v2 preserving all fields', () => {
    const legacyPlan = {
      weekStart: '2026-08-24',
      status: 'confirmed',
      statedRelaxations: ['time'],
      entries: DATES.map((date, idx) => ({
        kind: 'recipe',
        date,
        recipeId: `bundled-${idx + 1}`,
        plannedMealTime: `${date}T19:00:00-07:00`,
        statedRelaxations: ['time'],
        portionGuidance: null,
      })),
      groceryNeeds: [
        {
          ingredientId: 'garlic',
          recipeIds: ['bundled-1'],
          dates: ['2026-08-24'],
        },
      ],
    };

    const migrated = migrateWeeklyPlan(legacyPlan);
    expect(migrated).not.toBeNull();
    expect(migrated?.dayCount).toBe(7);
    expect(migrated?.mealSlots).toEqual(['dinner']);
    expect(migrated?.limitedVariety).toBe(false);
    expect(migrated?.status).toBe('confirmed');
    expect(migrated?.statedRelaxations).toEqual(['time']);
    expect(migrated?.entries).toHaveLength(7);
    migrated?.entries.forEach((entry, idx) => {
      expect(entry.date).toBe(DATES[idx]);
      expect(entry.mealSlot).toBe('dinner');
      if (entry.kind === 'recipe') {
        expect(entry.recipeId).toBe(`bundled-${idx + 1}`);
        expect(entry.plannedMealTime).toBe(`${DATES[idx]}T19:00:00-07:00`);
      }
    });
    expect(migrated?.groceryNeeds).toEqual(legacyPlan.groceryNeeds);
  });

  it('rejects legacy plans that do not have exactly 7 entries', () => {
    const incompleteLegacy = {
      weekStart: '2026-08-24',
      status: 'draft',
      statedRelaxations: [],
      entries: DATES.slice(0, 5).map((date) => ({
        kind: 'recipe',
        date,
        recipeId: 'bundled-1',
        plannedMealTime: `${date}T18:00:00Z`,
        statedRelaxations: [],
        portionGuidance: null,
      })),
      groceryNeeds: [],
    };

    expect(migrateWeeklyPlan(incompleteLegacy)).toBeNull();
  });

  it('rejects malformed plans where entries are invalid', () => {
    const malformedLegacy = {
      weekStart: '2026-08-24',
      status: 'draft',
      statedRelaxations: [],
      entries: 'not-an-array',
      groceryNeeds: [],
    };

    expect(migrateWeeklyPlan(malformedLegacy)).toBeNull();
  });
});
