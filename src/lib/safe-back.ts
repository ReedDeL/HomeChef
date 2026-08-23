/**
 * Resolves the destination for back navigation when stack history cannot go back.
 *
 * Falls back to explicit `fallbackHref` if supplied, otherwise routes to home (`/`)
 * or onboarding (`/(onboarding)/equipment`) depending on user's onboarding state.
 */
export function resolveSafeBackDestination(
  fallbackHref?: string,
  onboardingDone?: boolean
): string {
  if (fallbackHref) {
    return fallbackHref;
  }
  return onboardingDone ? '/' : '/(onboarding)/equipment';
}
