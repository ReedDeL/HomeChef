import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { StepFooter } from '@/components/ui/StepFooter';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { Text } from '@/components/ui/Text';
import { EQUIPMENT_TIERS, EXTRA_APPLIANCES, useKitchenStore } from '@/store/kitchen';
import { SelectableCard } from '@/components/ui/SelectableCard';
import { space } from '@/theme/tokens';

/**
 * Spec §3 — the first screen anyone sees (Step 1 of 3).
 *
 * Equipment leads onboarding because it is the wedge no competitor has: an app
 * that knows you own a microwave and nothing else is immediately, visibly
 * different from the one the user just deleted. It is also a hard constraint,
 * so the engine cannot produce an honest answer without it.
 */
export default function EquipmentScreen() {
  const router = useRouter();
  const tierId = useKitchenStore((state) => state.tierId);
  const extras = useKitchenStore((state) => state.extras);
  const setTier = useKitchenStore((state) => state.setTier);
  const toggleExtra = useKitchenStore((state) => state.toggleExtra);

  return (
    <Screen
      footer={
        <StepFooter
          forwardLabel="Continue ›"
          onForward={() => router.push('/(onboarding)/restrictions')}
          forwardHint="Goes to allergies and diet (Step 2)"
        />
      }
    >
      <StepIndicator currentStep={1} totalSteps={3} label="Kitchen Setup" />

      <View style={styles.intro}>
        <Text variant="display">What&apos;s in your kitchen?</Text>
        <Text variant="body" tone="muted">
          We&apos;ll only suggest meals you can actually cook.
        </Text>
      </View>

      <View
        style={styles.group}
        accessibilityRole="radiogroup"
        accessibilityLabel="Kitchen equipment tier"
        accessibilityHint="Choose the appliances you can cook with"
      >
        {EQUIPMENT_TIERS.map((tier) => (
          <SelectableCard
            key={tier.id}
            title={tier.label}
            subtitle={tier.subtitle}
            selected={tier.id === tierId}
            onPress={() => setTier(tier.id)}
            accessibilityHint="Sets which recipes count as cookable"
          />
        ))}
      </View>

      <View style={styles.group}>
        <Text variant="heading">Anything else?</Text>
        <View style={styles.chipRow}>
          {EXTRA_APPLIANCES.map((appliance) => (
            <Chip
              key={appliance.id}
              label={appliance.label}
              selected={extras.includes(appliance.id)}
              onPress={() => toggleExtra(appliance.id)}
              accessibilityLabel={appliance.label}
              accessibilityHint="Adds this appliance to your kitchen"
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm },
  group: { gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
