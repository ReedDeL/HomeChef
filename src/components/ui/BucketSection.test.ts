import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BucketSection } from '@/components/ui/BucketSection';
import type { ScoredRecipe } from '@/engine/types';

const scoredRecipe: ScoredRecipe = {
  recipe: {
    id: 'test-recipe-1',
    title: 'Garlic Butter Pasta',
    imageUrl: null,
    cuisine: 'italian',
    totalTimeMinutes: 20,
    equipmentRequired: ['microwave'],
    dietaryTags: ['vegetarian'],
    ingredients: [
      { id: 'pasta', measure: '200g', allergenGroups: ['gluten', 'wheat'] },
      { id: 'garlic', measure: '2 cloves', allergenGroups: [] },
      { id: 'butter', measure: '2 tbsp', allergenGroups: ['dairy'] },
    ],
    instructions: 'Boil and mix.',
    baseServings: 2,
    energyKcalPerServing: null,
    nutritionProvenance: null,
    nutritionConfidence: 'unavailable',
    source: 'bundled',
  },
  missing: [],
  bucket: 'ready',
  score: 1.0,
};

describe('BucketSection', () => {
  it('renders section title and recipes', () => {
    const markup = renderToStaticMarkup(
      createElement(BucketSection, {
        bucket: 'ready',
        recipes: [scoredRecipe],
        onSelectRecipe: () => undefined,
      })
    );

    expect(markup).toContain('MAKE IT NOW');
    expect(markup).toContain('Garlic Butter Pasta');
  });

  it('renders dislike action on cards when onDislikeRecipe is provided', () => {
    const markup = renderToStaticMarkup(
      createElement(BucketSection, {
        bucket: 'ready',
        recipes: [scoredRecipe],
        onSelectRecipe: () => undefined,
        onDislikeRecipe: () => undefined,
      })
    );

    expect(markup).toContain('I don&#x27;t like this');
  });

  it('returns null when recipes list is empty', () => {
    const markup = renderToStaticMarkup(
      createElement(BucketSection, {
        bucket: 'ready',
        recipes: [],
        onSelectRecipe: () => undefined,
      })
    );

    expect(markup).toBe('');
  });
});
