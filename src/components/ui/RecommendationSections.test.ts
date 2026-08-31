import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  buildRecommendationSections,
  getNextVisibleCount,
  getVisibleRecommendationSections,
  RecommendationSectionsView,
  REVEAL_BATCH_SIZE,
} from '@/components/ui/RecommendationSections';
import type { Bucket, ScoredRecipe } from '@/engine/types';

function scored(id: string, bucket: Bucket): ScoredRecipe {
  return {
    recipe: {
      id,
      title: `Recipe ${id}`,
      imageUrl: null,
      cuisine: 'other',
      totalTimeMinutes: 20,
      equipmentRequired: ['microwave'],
      dietaryTags: [],
      ingredients: [],
      instructions: 'Cook it.',
      baseServings: 1,
      energyKcalPerServing: null,
      nutritionProvenance: null,
      nutritionConfidence: 'unavailable',
      source: 'bundled',
    },
    missing: [],
    bucket,
    score: 1,
  };
}

describe('RecommendationSections', () => {
  it('maps engine buckets to the three product groups in order and removes duplicates', () => {
    const duplicate = scored('shared', 'missing_some');
    const sections = buildRecommendationSections({
      ready: [scored('ready', 'ready')],
      missing_few: [scored('near', 'missing_few')],
      missing_some: [duplicate],
      grocery_run: [duplicate, scored('far', 'grocery_run')],
    });

    expect(sections.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'ready_now', title: 'Ready now' },
      { id: 'missing_few', title: 'Missing a few' },
      { id: 'more_to_get', title: 'More to get' },
    ]);
    expect(sections.flatMap((section) => section.recipes.map((item) => item.recipe.id))).toEqual([
      'ready',
      'near',
      'shared',
      'far',
    ]);
  });

  it('reveals matches globally in batches of four without rendering empty headings', () => {
    const sections = buildRecommendationSections({
      ready: Array.from({ length: 5 }, (_, index) => scored(`ready-${index}`, 'ready')),
      missing_few: [scored('near', 'missing_few')],
      missing_some: [],
      grocery_run: [],
    });

    const firstBatch = getVisibleRecommendationSections(sections, REVEAL_BATCH_SIZE);
    expect(firstBatch).toHaveLength(1);
    expect(firstBatch[0]?.id).toBe('ready_now');
    expect(firstBatch[0]?.recipes).toHaveLength(4);

    const secondBatch = getVisibleRecommendationSections(
      sections,
      getNextVisibleCount(REVEAL_BATCH_SIZE, 6)
    );
    expect(secondBatch.map((section) => section.id)).toEqual(['ready_now', 'missing_few']);
    expect(secondBatch.flatMap((section) => section.recipes)).toHaveLength(6);
  });

  it('exposes an accessible show-more action until all matches are visible', () => {
    const sections = buildRecommendationSections({
      ready: Array.from({ length: 5 }, (_, index) => scored(`ready-${index}`, 'ready')),
      missing_few: [],
      missing_some: [],
      grocery_run: [],
    });

    const partialMarkup = renderToStaticMarkup(
      createElement(RecommendationSectionsView, {
        sections,
        visibleCount: REVEAL_BATCH_SIZE,
        onShowMore: () => undefined,
        onSelectRecipe: () => undefined,
      })
    );
    expect(partialMarkup).toContain('Show more matches');
    expect(partialMarkup).toContain('Showing 4 of 5 matches.');

    const completeMarkup = renderToStaticMarkup(
      createElement(RecommendationSectionsView, {
        sections,
        visibleCount: 5,
        onShowMore: () => undefined,
        onSelectRecipe: () => undefined,
      })
    );
    expect(completeMarkup).not.toContain('Show more matches');
    expect(completeMarkup).toContain('All 5 matches shown.');
  });
});
