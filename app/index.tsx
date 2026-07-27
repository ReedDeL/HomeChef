import { Redirect } from 'expo-router';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';

export default function Index() {
  const { profile } = useOnboarding();
  return <Redirect href={profile.hasCompletedOnboarding ? '/(tabs)' : '/onboarding/equipment'} />;
}
