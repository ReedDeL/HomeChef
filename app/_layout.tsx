import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { getDb } from '@/db/client';
import { OnboardingProvider } from '@/features/onboarding/OnboardingContext';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    getDb().then(() => setDbReady(true));
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <OnboardingProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="recipe/[id]" options={{ headerShown: true, title: '' }} />
          <Stack.Screen name="inventory/add-manual" options={{ headerShown: true, title: 'Add Ingredient' }} />
          <Stack.Screen name="inventory/scan-photo" options={{ headerShown: true, title: 'Scan Ingredients' }} />
        </Stack>
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}
