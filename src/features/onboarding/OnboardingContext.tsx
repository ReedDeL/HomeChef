import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getJSON, setJSON } from '@/lib/storage';
import { DEFAULT_PROFILE, type OnboardingProfile } from '@/features/onboarding/types';

const STORAGE_KEY = 'onboarding-profile';

interface OnboardingContextValue {
  profile: OnboardingProfile;
  updateProfile: (patch: Partial<OnboardingProfile>) => void;
  completeOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function loadProfile(): OnboardingProfile {
  return getJSON<OnboardingProfile>(STORAGE_KEY) ?? DEFAULT_PROFILE;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<OnboardingProfile>(loadProfile);

  const updateProfile = useCallback((patch: Partial<OnboardingProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      setJSON(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const completeOnboarding = useCallback(() => {
    updateProfile({ hasCompletedOnboarding: true });
  }, [updateProfile]);

  const value = useMemo(
    () => ({ profile, updateProfile, completeOnboarding }),
    [profile, updateProfile, completeOnboarding]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

/** Equipment/allergies/dietary/goals, entered once and never re-asked. */
export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
