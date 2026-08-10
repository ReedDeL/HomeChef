import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { StepFooter } from '@/components/ui/StepFooter';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { Text } from '@/components/ui/Text';
import { COMMON_ALLERGENS, DIETARY_PRESETS, useKitchenStore } from '@/store/kitchen';
import { space } from '@/theme/tokens';

/**
 * Spec §3.2 — allergies and diet (Step 2 of 3).
 *
 * The promise in the copy is load-bearing: allergens and dietary restrictions
 * are hard constraints that the relaxation ladder never touches, so "we'll
 * never suggest a recipe with these" is a statement about the engine and not
 * marketing. Skippable, because a safety question asked under pressure gets
 * answered badly.
 *
 * Selections made here are preserved if the user navigates back to kitchen setup
 * and returns, preventing accidental loss of safety preferences.
 */
export default function RestrictionsScreen() {
  const router = useRouter();
  const allergens = useKitchenStore((state) => state.allergens);
  const dietary = useKitchenStore((state) => state.dietary);
  const toggleAllergen = useKitchenStore((state) => state.toggleAllergen);
  const toggleDietary = useKitchenStore((state) => state.toggleDietary);

  const next = () => router.push('/(onboarding)/staples');
  const back = () => router.back();

  return (
    <Screen
      footer={
        <StepFooter
          onBack={back}
          backLabel="Back"
          backHint="Returns to kitchen setup (Step 1)"
          onForward={next}
          forwardLabel="Continue ›"
          forwardHint="Goes to pantry starter (Step 3)"
          secondaryAction={{
            label: 'Add later in settings',
            onPress: next,
            accessibilityHint: 'Skips allergies and diet for now',
          }}
        />
      }
    >
      <StepIndicator currentStep={2} totalSteps={3} label="Allergies & Diet" />

      <View style={styles.intro}>
        <Text variant="display">Anything to avoid?</Text>
        <Text variant="body" tone="muted">
          We&apos;ll never suggest a recipe with these. Promise.
        </Text>
      </View>

      <View style={styles.group}>
        <Text variant="heading">Allergies</Text>
        <View style={styles.chipRow}>
          {COMMON_ALLERGENS.map((allergen) => (
            <Chip
              key={allergen.id}
              label={allergen.label}
              selected={allergens.includes(allergen.id)}
              onPress={() => toggleAllergen(allergen.id)}
              accessibilityLabel={allergen.label}
              accessibilityHint="Recipes containing this are never shown"
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text variant="heading">Diet</Text>
        <View style={styles.chipRow}>
          {DIETARY_PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              label={preset.label}
              selected={dietary.includes(preset.id)}
              onPress={() => toggleDietary(preset.id)}
              accessibilityLabel={preset.label}
              accessibilityHint="Only recipes matching this are shown"
            />
          ))}
        </View>
        <Text variant="caption" tone="muted">
          Dietary tags are still being verified across the catalog, so choosing one here will narrow
          results sharply for now.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm },
  group: { gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  footer: { gap: space.sm },
});
