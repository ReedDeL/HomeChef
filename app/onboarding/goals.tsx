import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import type { WeightGoal } from '@/features/onboarding/types';

const GOAL_OPTIONS: { value: WeightGoal; label: string }[] = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain weight' },
  { value: null, label: "I'd rather not say" },
];

export default function GoalsScreen() {
  const { profile, updateProfile, completeOnboarding } = useOnboarding();

  const finish = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.step}>Step 4 of 4</Text>
        <Text style={styles.title}>Any goals?</Text>
        <Text style={styles.subtitle}>Optional — helps us weight suggestions, never blocks one.</Text>
        <View style={{ gap: 8 }}>
          {GOAL_OPTIONS.map((option) => {
            const selected = profile.weightGoal === option.value;
            return (
              <PrimaryButton
                key={option.label}
                label={option.label}
                variant={selected ? 'primary' : 'secondary'}
                onPress={() => updateProfile({ weightGoal: option.value })}
              />
            );
          })}
        </View>
      </View>
      <View style={styles.footer}>
        <PrimaryButton label="Start cooking" onPress={finish} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2' },
  content: { flex: 1, padding: 20, gap: 12 },
  step: { fontSize: 13, color: '#6B6B6B', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#6B6B6B', marginBottom: 8 },
  footer: { padding: 20 },
});
