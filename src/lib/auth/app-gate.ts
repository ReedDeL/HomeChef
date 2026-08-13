import type { AuthRoute } from './session-route';

export { authRoute, type AuthRoute, type AuthRouteInput } from './session-route';

type RouteGroup = '(auth)' | '(onboarding)';
export type AppGatePhase = 'loading' | 'redirecting' | 'ready';

const APP_ROUTE_NAMES = ['(tabs)', 'cook/[id]', 'recipe/[id]', 'scan', 'settings'] as const;

export const ROOT_ROUTE_NAMES = ['loading', '(auth)', '(onboarding)', ...APP_ROUTE_NAMES] as const;

export type RootRouteName = (typeof ROOT_ROUTE_NAMES)[number];

const routeGroups: Record<AuthRoute, RouteGroup | undefined> = {
  '/(auth)/sign-in': '(auth)',
  '/(onboarding)/equipment': '(onboarding)',
  '/': undefined,
};

export function needsRouteReplacement(
  currentGroup: string | undefined,
  target: AuthRoute
): boolean {
  return currentGroup !== routeGroups[target];
}

export function appGatePhase(
  hydrated: boolean,
  isAuthLoading: boolean,
  currentGroup: string | undefined,
  target: AuthRoute
): AppGatePhase {
  if (!hydrated || isAuthLoading) return 'loading';
  return needsRouteReplacement(currentGroup, target) ? 'redirecting' : 'ready';
}

export function rootRouteIsAvailable(
  routeName: RootRouteName,
  phase: AppGatePhase,
  target: AuthRoute
): boolean {
  if (phase === 'loading') return routeName === 'loading';
  if (target === '/(auth)/sign-in') return routeName === '(auth)';
  if (target === '/(onboarding)/equipment') return routeName === '(onboarding)';
  return phase === 'ready' && APP_ROUTE_NAMES.some((appRouteName) => appRouteName === routeName);
}
