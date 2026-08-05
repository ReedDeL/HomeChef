/**
 * Query key factory. One place to look when invalidating, so a cache bug is a
 * typo the compiler catches rather than a stale screen nobody can reproduce.
 */
export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  inventory: (householdId: string) => ['inventory', householdId] as const,
  preferences: (userId: string) => ['preferences', userId] as const,
  feedback: (userId: string) => ['feedback', userId] as const,
} as const;
