import { describe, expect, it } from 'vitest';

import { authRoute } from '@/lib/auth/session-route';

describe('authRoute', () => {
  it('sends a new local user to equipment onboarding', () => {
    expect(authRoute({ onboardingDone: false })).toBe('/(onboarding)/equipment');
  });

  it('sends a returning local user home', () => {
    expect(authRoute({ onboardingDone: true })).toBe('/');
  });
});
