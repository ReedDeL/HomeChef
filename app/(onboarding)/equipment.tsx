import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandLockup } from '@/components/BrandLockup';
import { EquipmentChecklist } from '@/components/ui/EquipmentChecklist';
import { Screen } from '@/components/ui/Screen';
import { StepFooter } from '@/components/ui/StepFooter';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { Text } from '@/components/ui/Text';
import type { SelectableEquipment } from '@/lib/equipment';
import { useKitchenStore } from '@/store/kitchen';
import { space } from '@/theme/tokens';

export default function EquipmentScreen() {
  const router = useRouter();
  const equipment = useKitchenStore((state) => state.equipment);
  const toggleEquipment = useKitchenStore((state) => state.toggleEquipment);
  const [showValidation, setShowValidation] = useState(false);

  const continueOnboarding = () => {
    if (equipment.length === 0) {
      setShowValidation(true);
      return;
    }
    router.push('/(onboarding)/restrictions');
  };

  const updateEquipment = (item: SelectableEquipment) => {
    toggleEquipment(item);
    setShowValidation(false);
  };

  return (
    <Screen
      footer={
        <StepFooter
          forwardLabel="Continue ›"
          onForward={continueOnboarding}
          forwardHint="Goes to allergies and diet (Step 2)"
        />
      }
    >
      <BrandLockup />
      <StepIndicator currentStep={1} totalSteps={4} label="Kitchen Setup" />

      <View style={styles.intro}>
        <Text variant="display">What&apos;s in your kitchen?</Text>
        <Text variant="body" tone="muted">
          Choose each item you can cook with.
        </Text>
      </View>

      <EquipmentChecklist selected={equipment} onToggle={updateEquipment} />

      {showValidation && equipment.length === 0 ? (
        <Text
          variant="caption"
          tone="accent"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          Choose your equipment or select No cooking equipment.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm },
});
