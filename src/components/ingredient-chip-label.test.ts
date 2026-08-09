import { describe, expect, it } from 'vitest';

import {
  ingredientChipAccessibility,
  resolveIngredientName,
} from '@/components/ingredient-chip-label';

describe('resolveIngredientName', () => {
  it('prefers the vocabulary display name', () => {
    expect(resolveIngredientName('achiote_paste')).toBe('achiote paste');
  });

  it('uses an explicit override when given', () => {
    expect(resolveIngredientName('achiote_paste', 'Achiote')).toBe('Achiote');
  });

  it('ignores a blank override rather than rendering an empty chip', () => {
    expect(resolveIngredientName('achiote_paste', '   ')).toBe('achiote paste');
  });

  it('humanises an id that is missing from the vocabulary', () => {
    expect(resolveIngredientName('not_a_real_ingredient')).toBe('not a real ingredient');
  });
});

describe('ingredientChipAccessibility', () => {
  it('announces the measure before the name', () => {
    const { label } = ingredientChipAccessibility('butter', 'neutral', '2 tbsp', false, false);
    expect(label).toBe('2 tbsp butter');
  });

  it('omits an empty measure instead of announcing a leading space', () => {
    const { label } = ingredientChipAccessibility('butter', 'neutral', '  ', false, false);
    expect(label).toBe('butter');
  });

  it('states the allergen risk in the label, not only in colour', () => {
    const { label } = ingredientChipAccessibility('peanut', 'allergen', undefined, false, false);
    expect(label).toBe('peanut. Contains an allergen you avoid.');
  });

  it('marks a missing ingredient as missing', () => {
    const { label } = ingredientChipAccessibility('butter', 'missing', undefined, false, false);
    expect(label).toBe('butter. Missing from your pantry.');
  });

  it('has no hint when the chip is not interactive', () => {
    const { hint } = ingredientChipAccessibility('butter', 'neutral', undefined, false, false);
    expect(hint).toBeUndefined();
  });

  it('describes the long-press drift correction when available', () => {
    const { hint } = ingredientChipAccessibility('butter', 'pantry', undefined, true, false);
    expect(hint).toBe("Long press if you don't have this");
  });

  it('describes both actions when the chip is removable and correctable', () => {
    const { hint } = ingredientChipAccessibility('butter', 'pantry', undefined, true, true);
    expect(hint).toBe(
      "Double tap to remove this from your pantry. Long press if you don't have this"
    );
  });
});
