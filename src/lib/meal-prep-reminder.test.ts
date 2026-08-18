import { describe, expect, it } from 'vitest';

import { getMealPrepReminder } from '@/lib/meal-prep-reminder';

const NOW = new Date('2026-08-13T17:00:00.000Z');
const DINNER = new Date('2026-08-13T19:00:00.000Z');

describe('getMealPrepReminder', () => {
  it('does not alert later than the recipe needs to start cooking', () => {
    const reminder = getMealPrepReminder(
      {
        id: 'plan-1',
        recipeId: 'recipe-1',
        recipeTitle: 'Tomato pasta',
        totalTimeMinutes: 30,
        plannedMealTime: DINNER,
      },
      10,
      NOW
    );

    expect(reminder?.notificationTime).toEqual(new Date('2026-08-13T18:30:00.000Z'));
  });

  it('alerts at the selected lead time when it is longer than cooking', () => {
    const reminder = getMealPrepReminder(
      {
        id: 'plan-2',
        recipeId: 'recipe-2',
        recipeTitle: 'Lentil soup',
        totalTimeMinutes: 15,
        plannedMealTime: DINNER,
      },
      60,
      NOW
    );

    expect(reminder?.notificationTime).toEqual(new Date('2026-08-13T18:00:00.000Z'));
  });

  it('excludes entries that cannot produce a future reminder', () => {
    const base = {
      id: 'plan-3',
      recipeId: 'recipe-3',
      recipeTitle: 'Rice bowl',
      totalTimeMinutes: 15,
      plannedMealTime: DINNER,
    };

    expect(getMealPrepReminder({ ...base, totalTimeMinutes: 0 }, 0, NOW)).toBeNull();
    expect(getMealPrepReminder({ ...base, plannedMealTime: NOW }, 0, NOW)).toBeNull();
    expect(
      getMealPrepReminder({ ...base, plannedMealTime: new Date('not a date') }, 0, NOW)
    ).toBeNull();
  });
});
