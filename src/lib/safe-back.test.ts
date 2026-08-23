import { describe, expect, it } from 'vitest';

import { resolveSafeBackDestination } from '@/lib/safe-back';

describe('resolveSafeBackDestination', () => {
  it('returns explicit fallbackHref when provided', () => {
    expect(resolveSafeBackDestination('/pantry', true)).toBe('/pantry');
    expect(resolveSafeBackDestination('/(onboarding)/equipment', false)).toBe(
      '/(onboarding)/equipment'
    );
    expect(resolveSafeBackDestination('/custom-route', true)).toBe('/custom-route');
  });

  it('defaults to home when onboarding is complete and no fallback is given', () => {
    expect(resolveSafeBackDestination(undefined, true)).toBe('/');
  });

  it('defaults to equipment onboarding when onboarding is not complete and no fallback is given', () => {
    expect(resolveSafeBackDestination(undefined, false)).toBe('/(onboarding)/equipment');
  });
});
