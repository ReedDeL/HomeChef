import { describe, expect, it } from 'vitest';

import { appGatePhase, needsRouteReplacement, rootRouteIsAvailable } from '@/lib/auth/app-gate';

const DYNAMIC_APP_ROUTES = ['cook/[id]', 'recipe/[id]'] as const;

describe('app gate routing', () => {
  it('does not replace when the user is already in the target group', () => {
    expect(needsRouteReplacement('(auth)', '/(auth)/sign-in')).toBe(false);
  });

  it('replaces an app route with sign-in for a signed-out user', () => {
    expect(needsRouteReplacement('(tabs)', '/(auth)/sign-in')).toBe(true);
  });

  it('shows only the neutral route while either store is hydrating', () => {
    expect(appGatePhase(false, false, '(tabs)', '/(auth)/sign-in')).toBe('loading');
    expect(appGatePhase(true, true, '(tabs)', '/(auth)/sign-in')).toBe('loading');
  });

  it('withholds the current route until its group matches the target', () => {
    expect(appGatePhase(true, false, '(tabs)', '/(auth)/sign-in')).toBe('redirecting');
    expect(appGatePhase(true, false, undefined, '/')).toBe('ready');
    expect(appGatePhase(true, false, '(auth)', '/(auth)/sign-in')).toBe('ready');
  });

  it.each(DYNAMIC_APP_ROUTES)(
    'protects the %s route while signed out but exposes it for an authenticated redirect',
    (routeName) => {
      expect(rootRouteIsAvailable(routeName, 'loading', '/(auth)/sign-in')).toBe(false);
      expect(rootRouteIsAvailable(routeName, 'redirecting', '/(auth)/sign-in')).toBe(false);
      expect(rootRouteIsAvailable(routeName, 'redirecting', '/')).toBe(true);
      expect(rootRouteIsAvailable(routeName, 'ready', '/(auth)/sign-in')).toBe(false);
      expect(rootRouteIsAvailable(routeName, 'ready', '/')).toBe(true);
    }
  );
});
