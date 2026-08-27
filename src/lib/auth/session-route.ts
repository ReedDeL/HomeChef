export type AuthRoute = '/(onboarding)/equipment' | '/';

export interface AuthRouteInput {
  onboardingDone: boolean;
}

export function authRoute(input: AuthRouteInput): AuthRoute {
  return input.onboardingDone ? '/' : '/(onboarding)/equipment';
}
