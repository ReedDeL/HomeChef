import type { Relaxation } from '@/engine/types';

export const ANALYTICS_EVENTS = {
  onboardingCompleted: 'onboarding_completed',
  pantryFilterSubmitted: 'pantry_filter_submitted',
  recommendationsShown: 'recommendations_shown',
  recipeOpened: 'recipe_opened',
  cookModeStarted: 'cook_mode_started',
  cookModeCompleted: 'cook_mode_completed',
  constraintRelaxed: 'constraint_relaxed',
  visionScanSucceeded: 'vision_scan_succeeded',
  visionScanFailed: 'vision_scan_failed',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
export type AnalyticsProperty = string | number | boolean;
export type AnalyticsProperties = Record<string, AnalyticsProperty>;

export interface AnalyticsClient {
  capture(event: AnalyticsEventName, properties?: AnalyticsProperties): void;
  identify(userId: string): void;
  reset(): void;
}

export interface PantryFilterSubmittedProperties extends AnalyticsProperties {
  time_limit_minutes: number;
}

export interface RecommendationsShownProperties extends AnalyticsProperties {
  recommendation_count: number;
}

export interface RecipeEventProperties extends AnalyticsProperties {
  recipe_id: string;
}

export interface CookModeStartedProperties extends RecipeEventProperties {
  step_count: number;
}

export interface ConstraintRelaxedProperties extends AnalyticsProperties {
  constraint: Relaxation['kind'];
}

export interface VisionScanSucceededProperties extends AnalyticsProperties {
  photo_count: number;
  candidate_count: number;
  accepted_count: number;
}

export interface VisionScanFailedProperties extends AnalyticsProperties {
  photo_count: number;
  failure_stage: 'analyze';
}

const approvedEventNames = new Set<string>(Object.values(ANALYTICS_EVENTS));
let analyticsClient: AnalyticsClient | null = null;

export function isAnalyticsConfigured(apiKey: string): boolean {
  return apiKey.trim().length > 0;
}

export function isApprovedAnalyticsEvent(event: string): event is AnalyticsEventName {
  return approvedEventNames.has(event);
}

export function setAnalyticsClient(client: AnalyticsClient | null): void {
  analyticsClient = client;
}

function capture(event: AnalyticsEventName, properties?: AnalyticsProperties): void {
  try {
    analyticsClient?.capture(event, properties);
  } catch {
    // Analytics must never block navigation or a product action.
  }
}

export function identifyAuthenticatedUser(userId: string): void {
  if (userId.trim().length === 0) return;

  try {
    // The stable auth ID is the only person property sent to PostHog.
    analyticsClient?.identify(userId);
  } catch {
    // Identity linkage is best-effort and must not affect authentication.
  }
}

export function resetAnalyticsIdentity(): void {
  try {
    analyticsClient?.reset();
  } catch {
    // Logout must succeed even if analytics persistence cannot be cleared.
  }
}

export function trackOnboardingCompleted(): void {
  capture(ANALYTICS_EVENTS.onboardingCompleted);
}

export function trackPantryFilterSubmitted(properties: PantryFilterSubmittedProperties): void {
  capture(ANALYTICS_EVENTS.pantryFilterSubmitted, properties);
}

export function trackRecommendationsShown(properties: RecommendationsShownProperties): void {
  capture(ANALYTICS_EVENTS.recommendationsShown, properties);
}

export function trackRecipeOpened(properties: RecipeEventProperties): void {
  capture(ANALYTICS_EVENTS.recipeOpened, properties);
}

export function trackCookModeStarted(properties: CookModeStartedProperties): void {
  capture(ANALYTICS_EVENTS.cookModeStarted, properties);
}

export function trackCookModeCompleted(properties: RecipeEventProperties): void {
  capture(ANALYTICS_EVENTS.cookModeCompleted, properties);
}

export function trackConstraintRelaxed(properties: ConstraintRelaxedProperties): void {
  capture(ANALYTICS_EVENTS.constraintRelaxed, properties);
}

export function trackVisionScanSucceeded(properties: VisionScanSucceededProperties): void {
  capture(ANALYTICS_EVENTS.visionScanSucceeded, properties);
}

export function trackVisionScanFailed(properties: VisionScanFailedProperties): void {
  capture(ANALYTICS_EVENTS.visionScanFailed, properties);
}
