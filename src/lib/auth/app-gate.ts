import type { AuthRoute } from './session-route';

export { authRoute, type AuthRoute, type AuthRouteInput } from './session-route';

type RouteGroup = '(auth)' | '(onboarding)';

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
