/**
 * Query key factory. One place to look when invalidating, so a cache bug is a
 * typo the compiler catches rather than a stale screen nobody can reproduce.
 */
export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  inventory: (householdId: string) => ['inventory', householdId] as const,
  preferences: (userId: string) => ['preferences', userId] as const,
  feedback: (userId: string) => ['feedback', userId] as const,
  satiety: (userId: string) => ['meal-satiety', userId] as const,
  bodyProfile: (userId: string) => ['body-profile', userId] as const,
  tasteSignals: (userId: string) => ['taste-signals', userId] as const,
  mealSatiety: (userId: string) => ['meal-satiety', userId] as const,
  onboardingProgress: (userId: string) => ['onboarding-progress', userId] as const,
  weeklyMealPlan: (userId: string, weekStart: string) =>
    ['weekly-meal-plan', userId, weekStart] as const,
  mealReminderPreferences: (userId: string) => ['meal-reminder-preferences', userId] as const,
} as const;
