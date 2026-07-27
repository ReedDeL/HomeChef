import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="equipment" />
      <Stack.Screen name="allergies" />
      <Stack.Screen name="dietary" />
      <Stack.Screen name="goals" />
    </Stack>
  );
}
