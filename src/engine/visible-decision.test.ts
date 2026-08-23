import { describe, expect, it } from 'vitest';
import { makeRecipe } from '@/engine/__fixtures__';
import { BUCKET_ORDER } from '@/engine/bucket';
import { toVisibleDecision } from '@/engine/visible-decision';
import type { Bucket, DecisionResult, ScoredRecipe } from '@/engine/types';

function scored(bucket: Bucket, id: string): ScoredRecipe {
  return {
    recipe: makeRecipe({ id }),
    missing: [],
    bucket,
    score: 100,
  };
}

function fullDecision(): DecisionResult {
  return {
    buckets: {
      ready: Array.from({ length: 4 }, (_, index) => scored('ready', `ready-${index}`)),
      missing_few: Array.from({ length: 4 }, (_, index) => scored('missing_few', `few-${index}`)),
      missing_some: Array.from({ length: 4 }, (_, index) =>
        scored('missing_some', `some-${index}`)
      ),
      grocery_run: Array.from({ length: 4 }, (_, index) =>
        scored('grocery_run', `grocery-${index}`)
      ),
    },
    appliedRelaxations: [{ kind: 'cuisine_dropped', cuisine: 'thai' }],
  };
}

describe('toVisibleDecision', () => {
  it('exposes at most four total recipes across all buckets', () => {
    const visible = toVisibleDecision(fullDecision());

    expect(Object.values(visible.buckets).flat()).toHaveLength(4);
    expect(visible.buckets.ready?.map(({ recipe }) => recipe.id)).toEqual([
      'ready-0',
      'ready-1',
      'ready-2',
      'ready-3',
    ]);
  });

  it('consumes recipes in readiness order and removes empty buckets', () => {
    const decision = fullDecision();
    decision.buckets.ready = [scored('ready', 'ready')];
    decision.buckets.missing_few = [];
    decision.buckets.missing_some = [
      scored('missing_some', 'some-0'),
      scored('missing_some', 'some-1'),
      scored('missing_some', 'some-2'),
      scored('missing_some', 'some-3'),
    ];

    const visible = toVisibleDecision(decision);

    expect(Object.keys(visible.buckets)).toEqual(['ready', 'missing_some']);
    expect(Object.keys(visible.buckets)).toEqual(
      BUCKET_ORDER.filter((bucket) => visible.buckets[bucket] !== undefined)
    );
    expect(visible.buckets.missing_some?.map(({ recipe }) => recipe.id)).toEqual([
      'some-0',
      'some-1',
      'some-2',
    ]);
    expect(visible.appliedRelaxations).toEqual(decision.appliedRelaxations);
  });

  it('honors a smaller caller-supplied limit', () => {
    expect(Object.values(toVisibleDecision(fullDecision(), 2).buckets).flat()).toHaveLength(2);
  });

  it('never lets a larger caller limit exceed the four-answer surface cap', () => {
    expect(Object.values(toVisibleDecision(fullDecision(), 12).buckets).flat()).toHaveLength(4);
  });
});
