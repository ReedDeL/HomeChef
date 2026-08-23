import { describe, expect, it } from 'vitest';
import { PER_BUCKET_RESULT_CAP, bucketFor } from '@/engine/bucket';

// Bucketing is by COUNT of missing ingredients, not match percentage
// (docs/01_TECHNICAL_SPEC.md:450). Every boundary is pinned explicitly.
describe('bucketFor', () => {
  it('0 missing -> ready', () => {
    expect(bucketFor(0)).toBe('ready');
  });

  it('1 and 2 missing -> missing_few', () => {
    expect(bucketFor(1)).toBe('missing_few');
    expect(bucketFor(2)).toBe('missing_few');
  });

  // The two boundaries most likely to be written off by one.
  it('3 missing -> missing_some, not missing_few', () => {
    expect(bucketFor(3)).toBe('missing_some');
  });

  it('4 missing -> missing_some', () => {
    expect(bucketFor(4)).toBe('missing_some');
  });

  it('5 missing -> grocery_run, not missing_some', () => {
    expect(bucketFor(5)).toBe('grocery_run');
  });

  it('a large count stays in grocery_run', () => {
    expect(bucketFor(20)).toBe('grocery_run');
  });
});

describe('PER_BUCKET_RESULT_CAP', () => {
  // Truncation is the product (docs/01_TECHNICAL_SPEC.md:452).
  it('is 4', () => {
    expect(PER_BUCKET_RESULT_CAP).toBe(4);
  });
});
