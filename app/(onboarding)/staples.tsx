import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/ui/Header';
import { IngredientChip } from '@/components/ui/IngredientChip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { StepFooter } from '@/components/ui/StepFooter';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { Text } from '@/components/ui/Text';
import { COMMON_PANTRY_IDS, useKitchenStore } from '@/store/kitchen';
import { STAPLE_INGREDIENT_IDS } from '@/data/catalog';
import { trackOnboardingCompleted } from '@/lib/analytics';
import { space } from '@/theme/tokens';

/**
 * Spec §3 — the pantry starter (Step 3 of 3).
 *
 * Pre-populating and asking the user to *remove* what they lack is the whole
 * trick: it is faster than adding twenty items, and it teaches the correction
 * gesture ("tap what's wrong") that the rest of the app depends on before the
 * user has a pantry worth breaking.
 *
 * The spec also puts the first photo capture here. It is offered but never
 * required: the staples above already give the engine enough to work with, and
 * making a camera permission prompt the price of finishing setup would be the
 * opposite of "onboarding is a tax, keep it short".
 *
 * All pantry customizations are remembered across step navigation.
 */
export default function StaplesScreen() {
  const router = useRouter();
  const pantry = useKitchenStore((state) => state.pantry);
  const togglePantryItem = useKitchenStore((state) => state.togglePantryItem);
  const completeOnboarding = useKitchenStore((state) => state.completeOnboarding);

  const finish = () => {
    trackOnboardingCompleted();
    completeOnboarding();
    router.replace('/');
  };

  const toggleIngredient = (id: (typeof pantry)[number]) => {
    togglePantryItem(id);
  };

  const back = () => router.back();

  const extras = COMMON_PANTRY_IDS.filter((id) => !STAPLE_INGREDIENT_IDS.includes(id));

  return (
    <Screen
      header={
        <Header
          onBack={back}
          backLabel="Allergies"
          backHint="Returns to allergies and diet (Step 2)"
          fallbackHref="/(onboarding)/restrictions"
        />
      }
      footer={
        <StepFooter
          onBack={back}
          backLabel="Back"
          backHint="Returns to allergies and diet (Step 2)"
          onForward={finish}
          forwardLabel="Show me meals"
          forwardHint="Finishes setup and opens the app"
        />
      }
    >
      <StepIndicator currentStep={3} totalSteps={3} label="Pantry Starter" />

      <View style={styles.intro}>
        <Text variant="display">We assumed you have these.</Text>
        <Text variant="body" tone="muted">
          Tap any you don&apos;t.
        </Text>
      </View>

      <View style={styles.group}>
        <View style={styles.chipRow}>
          {STAPLE_INGREDIENT_IDS.map((id) => (
            <IngredientChip
              key={id}
              id={id}
              inPantry={pantry.includes(id)}
              onToggle={toggleIngredient}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text variant="heading">Anything else in the fridge?</Text>
        <View style={styles.chipRow}>
          {extras.map((id) => (
            <IngredientChip
              key={id}
              id={id}
              inPantry={pantry.includes(id)}
              onToggle={toggleIngredient}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text variant="heading">Or photograph your fridge</Text>
        <Text variant="body" tone="muted">
          Faster than tapping. We&apos;ll show you what we found before adding anything.
        </Text>
        <PrimaryButton
          label="Take a photo"
          variant="ghost"
          onPress={() => router.push('/scan')}
          accessibilityHint="Photograph your kitchen to add ingredients"
        />
      </View>

      <Text variant="caption" tone="muted">
        {pantry.length} {pantry.length === 1 ? 'ingredient' : 'ingredients'} in your pantry. You can
        fix this any time.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm },
  group: { gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
