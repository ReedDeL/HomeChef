import { describe, expect, it } from 'vitest';

import {
  SATIETY_LEVELS,
  isMealSatietyLevel,
  satietyLabel,
  toMealSatietyInsert,
} from '@/lib/meal-satiety';

describe('meal satiety domain', () => {
  it('keeps the supported levels in the UI order', () => {
    expect(SATIETY_LEVELS).toEqual(['still_hungry', 'satisfied', 'too_full']);
  });

  it('accepts only the database CHECK values', () => {
    expect(isMealSatietyLevel('satisfied')).toBe(true);
    expect(isMealSatietyLevel('very_full')).toBe(false);
    expect(isMealSatietyLevel(null)).toBe(false);
  });

  it('builds the exact insert shape without a client timestamp', () => {
    expect(toMealSatietyInsert('user-1', 'recipe-1', 'too_full')).toEqual({
      user_id: 'user-1',
      recipe_id: 'recipe-1',
      level: 'too_full',
    });
  });

  it('uses human-readable labels for each allowed level', () => {
    expect(satietyLabel('still_hungry')).toBe('Still hungry');
    expect(satietyLabel('satisfied')).toBe('Satisfied');
    expect(satietyLabel('too_full')).toBe('Too full');
  });
});
