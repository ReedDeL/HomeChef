import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { ChipMultiSelect } from '@/components/ChipMultiSelect';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useToast } from '@/components/ToastProvider';
import { useAuth } from '@/features/auth/AuthContext';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { DIETARY_OPTIONS, EQUIPMENT_OPTIONS } from '@/features/onboarding/types';
import type { WeightGoal } from '@/features/onboarding/types';

const GOAL_OPTIONS: { value: WeightGoal; label: string }[] = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain weight' },
  { value: null, label: "I'd rather not say" },
];

export default function SettingsScreen() {
  const { profile, updateProfile } = useOnboarding();
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const [allergyDraft, setAllergyDraft] = useState('');

  const handleSignOut = async () => {
    await signOut();
    showToast('Signed out');
  };

  const addAllergy = () => {
    const value = allergyDraft.trim().toLowerCase();
    if (!value || profile.allergies.includes(value)) {
      setAllergyDraft('');
      return;
    }
    updateProfile({ allergies: [...profile.allergies, value] });
    setAllergyDraft('');
  };

  const removeAllergy = (value: string) => {
    updateProfile({ allergies: profile.allergies.filter((a) => a !== value) });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {user ? (
          <>
            <Text style={styles.accountEmail}>{user.email}</Text>
            <PrimaryButton label="Sign out" variant="secondary" onPress={handleSignOut} />
          </>
        ) : (
          <>
            <Text style={styles.accountHint}>
              Signed out — your pantry still works locally. Sign in once you want it synced across
              devices or shared with roommates.
            </Text>
            <PrimaryButton label="Sign in" onPress={() => router.push('/auth/sign-in')} />
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Equipment</Text>
        <ChipMultiSelect
          options={EQUIPMENT_OPTIONS}
          selected={profile.equipment}
          onChange={(equipment) => updateProfile({ equipment })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allergies</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={allergyDraft}
            onChangeText={setAllergyDraft}
            placeholder="e.g. peanuts"
            onSubmitEditing={addAllergy}
            returnKeyType="done"
            style={styles.input}
          />
          <Pressable onPress={addAllergy} style={styles.addButton}>
            <Text style={styles.addButtonLabel}>Add</Text>
          </Pressable>
        </View>
        <View style={{ gap: 8 }}>
          {profile.allergies.map((allergy) => (
            <View key={allergy} style={styles.allergyRow}>
              <Text style={styles.allergyText}>{allergy}</Text>
              <Pressable onPress={() => removeAllergy(allergy)} hitSlop={8}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dietary preferences</Text>
        <ChipMultiSelect
          options={DIETARY_OPTIONS}
          selected={profile.dietaryPreferences}
          onChange={(dietaryPreferences) => updateProfile({ dietaryPreferences })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Goals</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2' },
  content: { padding: 16, gap: 28, paddingBottom: 48 },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D0D5CE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  addButton: {
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#1F6F50',
  },
  addButtonLabel: { color: 'white', fontWeight: '600' },
  allergyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  allergyText: { fontSize: 15, textTransform: 'capitalize' },
  removeText: { color: '#B4232A', fontSize: 13, fontWeight: '600' },
  accountEmail: { fontSize: 15, color: '#1A1A1A', fontWeight: '600' },
  accountHint: { fontSize: 13, color: '#6B6B6B' },
});
