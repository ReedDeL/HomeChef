export type AuthRoute = '/(auth)/sign-in' | '/(onboarding)/equipment' | '/';

export interface AuthRouteInput {
  isAuthenticated: boolean;
  onboardingDone: boolean;
}

export function authRoute(input: AuthRouteInput): AuthRoute {
  if (!input.isAuthenticated) return '/(auth)/sign-in';
  return input.onboardingDone ? '/' : '/(onboarding)/equipment';
}
