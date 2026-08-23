import { describe, expect, it } from 'vitest';
import { toPersistableSpoonacularRecipe } from '@/lib/spoonacular-persistence';

describe('toPersistableSpoonacularRecipe', () => {
  it('constructs the exact persistence whitelist in stable key order', () => {
    const persistable = toPersistableSpoonacularRecipe({
      id: 'spoon-123',
      title: 'Borrowed Pasta',
      imageUrl: 'https://example.com/pasta.jpg',
      ingredients: [{ id: 'pasta' }],
      instructions: 'Borrowed instructions',
      totalTimeMinutes: 20,
      equipmentRequired: ['stove'],
      servings: 2,
      nutrition: { calories: 500 },
    });

    expect(persistable).toEqual({
      id: 'spoon-123',
      title: 'Borrowed Pasta',
      imageUrl: 'https://example.com/pasta.jpg',
    });
    expect(Object.keys(persistable ?? {})).toEqual(['id', 'title', 'imageUrl']);
  });

  it('accepts an explicit null image URL', () => {
    expect(
      toPersistableSpoonacularRecipe({ id: 'spoon-123', title: 'Borrowed Pasta', imageUrl: null })
    ).toEqual({ id: 'spoon-123', title: 'Borrowed Pasta', imageUrl: null });
  });

  it.each([
    null,
    [],
    { title: 'Missing ID', imageUrl: null },
    { id: '', title: 'Empty ID', imageUrl: null },
    { id: 'spoon-123', title: '', imageUrl: null },
    { id: 'spoon-123', title: 'Wrong image', imageUrl: 42 },
  ])('returns null for invalid input %#', (input) => {
    expect(toPersistableSpoonacularRecipe(input)).toBeNull();
  });
});
