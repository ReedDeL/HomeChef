import { describe, expect, it } from 'vitest';

import { needsRouteReplacement } from '@/lib/auth/app-gate';

describe('needsRouteReplacement', () => {
  it('does not replace when the user is already in the target group', () => {
    expect(needsRouteReplacement('(auth)', '/(auth)/sign-in')).toBe(false);
  });

  it('replaces an app route with sign-in for a signed-out user', () => {
    expect(needsRouteReplacement('(tabs)', '/(auth)/sign-in')).toBe(true);
  });
});
