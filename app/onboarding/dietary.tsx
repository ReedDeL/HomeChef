import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChipMultiSelect } from '@/components/ChipMultiSelect';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { DIETARY_OPTIONS } from '@/features/onboarding/types';

export default function DietaryScreen() {
  const { profile, updateProfile } = useOnboarding();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.step}>Step 3 of 4</Text>
        <Text style={styles.title}>Dietary preferences</Text>
        <Text style={styles.subtitle}>Optional. Skip if none of these apply.</Text>
        <ChipMultiSelect
          options={DIETARY_OPTIONS}
          selected={profile.dietaryPreferences}
          onChange={(dietaryPreferences) => updateProfile({ dietaryPreferences })}
        />
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label="Next" onPress={() => router.push('/onboarding/goals')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2' },
  content: { padding: 20, gap: 12 },
  step: { fontSize: 13, color: '#6B6B6B', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#6B6B6B', marginBottom: 8 },
  footer: { padding: 20 },
});
