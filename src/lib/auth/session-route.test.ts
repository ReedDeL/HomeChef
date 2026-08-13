import { describe, expect, it } from 'vitest';

import { authRoute } from '@/lib/auth/session-route';

describe('authRoute', () => {
  it('sends signed-out users to sign-in even after local onboarding', () => {
    expect(authRoute({ isAuthenticated: false, onboardingDone: true })).toBe('/(auth)/sign-in');
  });

  it('sends a new signed-in user to equipment onboarding', () => {
    expect(authRoute({ isAuthenticated: true, onboardingDone: false })).toBe(
      '/(onboarding)/equipment'
    );
  });

  it('sends a returning signed-in user home', () => {
    expect(authRoute({ isAuthenticated: true, onboardingDone: true })).toBe('/');
  });
});
