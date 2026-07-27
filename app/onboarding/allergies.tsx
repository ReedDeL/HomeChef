import { useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';

export default function AllergiesScreen() {
  const { profile, updateProfile } = useOnboarding();
  const [draft, setDraft] = useState('');

  const addAllergy = () => {
    const value = draft.trim().toLowerCase();
    if (!value || profile.allergies.includes(value)) {
      setDraft('');
      return;
    }
    updateProfile({ allergies: [...profile.allergies, value] });
    setDraft('');
  };

  const removeAllergy = (value: string) => {
    updateProfile({ allergies: profile.allergies.filter((a) => a !== value) });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.step}>Step 2 of 4</Text>
        <Text style={styles.title}>Any allergies?</Text>
        <Text style={styles.subtitle}>
          Asked once, saved, never re-asked. We'll filter these out of every recommendation.
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. peanuts"
            onSubmitEditing={addAllergy}
            returnKeyType="done"
            style={styles.input}
          />
          <Pressable onPress={addAllergy} style={styles.addButton}>
            <Text style={styles.addButtonLabel}>Add</Text>
          </Pressable>
        </View>
        <FlatList
          data={profile.allergies}
          keyExtractor={(item) => item}
          contentContainerStyle={{ gap: 8, paddingTop: 12 }}
          renderItem={({ item }) => (
            <View style={styles.allergyRow}>
              <Text style={styles.allergyText}>{item}</Text>
              <Pressable onPress={() => removeAllergy(item)} hitSlop={8}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
      <View style={styles.footer}>
        <PrimaryButton label="Next" onPress={() => router.push('/onboarding/dietary')} />
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
  footer: { padding: 20 },
});
