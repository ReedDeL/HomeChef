import type { Bucket } from '@/engine/types';

/**
 * Truncation is the product (docs/01_TECHNICAL_SPEC.md:452). Comprehensiveness
 * is our competitors' value proposition and the thing we deliberately do not do.
 */
export const PER_BUCKET_RESULT_CAP = 4;

export const BUCKET_ORDER: readonly Bucket[] = [
  'ready',
  'missing_few',
  'missing_some',
  'grocery_run',
];

/**
 * Bucketing is by COUNT of missing ingredients, not by match percentage:
 * 0 -> ready | 1-2 -> missing a few | 3-4 -> missing more | 5+ -> grocery run.
 *
 * Count rather than ratio because "you are two ingredients away" means the same
 * thing to a user whether the recipe has 5 ingredients or 15.
 */
export function bucketFor(missingCount: number): Bucket {
  if (missingCount === 0) return 'ready';
  if (missingCount <= 2) return 'missing_few';
  if (missingCount <= 4) return 'missing_some';
  return 'grocery_run';
}
