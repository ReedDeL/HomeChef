export type AnalyticsProperty = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsProperty>;

export interface AnalyticsClient {
  capture(event: string, properties?: AnalyticsProperties): void;
}

export interface OnboardingCompletedProperties {
  pantry_count: number;
  equipment_tier: string;
  allergen_count: number;
  dietary_restriction_count: number;
}

export interface PantryScanStartedProperties {
  source: 'camera' | 'library';
}

export interface PantryScanCompletedProperties {
  photo_count: number;
  candidate_count: number;
  accepted_count: number;
}

export interface PantryScanFailedProperties {
  photo_count: number;
  failure_stage: string;
}

export interface PantryItemChangedProperties {
  source: string;
  item_count: number;
}

export interface RecipeViewedProperties {
  recipe_id: string;
  source: string;
}

export interface RecipeProperties {
  recipe_id: string;
}

export interface CookModeStartedProperties extends RecipeProperties {
  step_count: number;
}

export interface CookModeCompletedProperties extends RecipeProperties {
  liked: boolean;
  removed_ingredients: number;
}

export interface RecipeFeedbackSubmittedProperties extends RecipeProperties {
  liked: boolean;
}

export interface SettingsUpdatedProperties {
  setting: string;
  value: AnalyticsProperty;
}

let analyticsClient: AnalyticsClient | null = null;

export function setAnalyticsClient(client: AnalyticsClient | null): void {
  analyticsClient = client;
}

function capture(event: string, properties: AnalyticsProperties): void {
  try {
    analyticsClient?.capture(event, properties);
  } catch {
    // Analytics must never block navigation or a product action.
  }
}

export function trackPageView(route: string): void {
  capture('page_view', { route });
}

export function trackOnboardingCompleted(properties: OnboardingCompletedProperties): void {
  capture('onboarding_completed', properties);
}

export function trackPantryScanStarted(properties: PantryScanStartedProperties): void {
  capture('pantry_scan_started', properties);
}

export function trackPantryScanCompleted(properties: PantryScanCompletedProperties): void {
  capture('pantry_scan_completed', properties);
}

export function trackPantryScanFailed(properties: PantryScanFailedProperties): void {
  capture('pantry_scan_failed', properties);
}

export function trackPantryItemAdded(properties: PantryItemChangedProperties): void {
  capture('pantry_item_added', properties);
}

export function trackPantryItemRemoved(properties: PantryItemChangedProperties): void {
  capture('pantry_item_removed', properties);
}

export function trackRecipeViewed(properties: RecipeViewedProperties): void {
  capture('recipe_viewed', properties);
}

export function trackRecipeDisliked(properties: RecipeProperties): void {
  capture('recipe_disliked', properties);
}

export function trackCookModeStarted(properties: CookModeStartedProperties): void {
  capture('cook_mode_started', properties);
}

export function trackCookModeCompleted(properties: CookModeCompletedProperties): void {
  capture('cook_mode_completed', properties);
}

export function trackRecipeFeedbackSubmitted(
  properties: RecipeFeedbackSubmittedProperties
): void {
  capture('recipe_feedback_submitted', properties);
}

export function trackSettingsUpdated(properties: SettingsUpdatedProperties): void {
  capture('settings_updated', properties);
}

export function normalizeRoute(segments: readonly string[]): string {
  const visibleSegments = segments.flatMap((segment) => {
    if (segment === '(onboarding)') return ['onboarding'];
    return segment.startsWith('(') ? [] : [segment];
  });

  if (visibleSegments.length === 0 || (visibleSegments.length === 1 && visibleSegments[0] === 'index')) {
    return '/';
  }

  const routeSegments = [...visibleSegments];
  if (routeSegments[0] === 'index') {
    routeSegments.shift();
  }

  if ((routeSegments[0] === 'recipe' || routeSegments[0] === 'cook') && routeSegments.length > 1) {
    routeSegments[1] = ':id';
  }

  return routeSegments.length === 0 ? '/' : `/${routeSegments.join('/')}`;
}
