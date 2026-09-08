import { useRouter } from 'expo-router';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { EquipmentChecklist } from '@/components/ui/EquipmentChecklist';
import { Header } from '@/components/ui/Header';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import {
  EQUIPMENT_CHECKLIST_OPTIONS,
  toggleOwnedEquipment,
  type SelectableEquipment,
} from '@/lib/equipment';
import { useKitchenStore } from '@/store/kitchen';
import { space } from '@/theme/tokens';

export default function KitchenSetupScreen() {
  const router = useRouter();
  const equipment = useKitchenStore((state) => state.equipment);
  const toggleEquipment = useKitchenStore((state) => state.toggleEquipment);

  const updateEquipment = (item: SelectableEquipment) => {
    const option = EQUIPMENT_CHECKLIST_OPTIONS.find((candidate) => candidate.id === item);
    const next = toggleOwnedEquipment(equipment, item);
    toggleEquipment(item);
    AccessibilityInfo.announceForAccessibility(
      next.includes(item)
        ? `${option?.label ?? 'Equipment'} added to your kitchen.`
        : `${option?.label ?? 'Equipment'} removed from your kitchen.`
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  return (
    <Screen
      header={
        <Header
          title="Kitchen Setup"
          backLabel="Settings"
          backAccessibilityLabel="Back to Settings"
          backHint="Returns to Settings"
          onBack={handleBack}
          fallbackHref="/settings"
        />
      }
    >
      <View style={styles.intro}>
        <Text variant="display">Kitchen Setup</Text>
        <Text variant="body" tone="muted">
          Choose each item you can cook with. Changes save automatically.
        </Text>
        <Text variant="caption" tone="muted">
          Your pantry, dietary restrictions, allergens, saved choices, and history stay exactly as
          they are.
        </Text>
      </View>

      <EquipmentChecklist selected={equipment} onToggle={updateEquipment} />

      {equipment.length === 0 ? (
        <Text
          variant="caption"
          tone="accent"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          Choose your equipment or select No cooking equipment.
        </Text>
      ) : (
        <View
          style={styles.confirmation}
          accessibilityLiveRegion="polite"
          accessibilityLabel="Kitchen setup changes save automatically"
          accessibilityHint="Status confirmation for saved equipment changes"
        >
          <Text variant="bodyStrong">Saved automatically</Text>
          <Text variant="caption" tone="muted">
            Now and Plan will use these choices for recommendations.
          </Text>
        </View>
      )}

      <View style={styles.returnActions}>
        <Text variant="heading">Where would you like to go?</Text>
        <PrimaryButton
          label="Return to Now"
          onPress={() => router.replace('/(tabs)')}
          accessibilityHint="Returns to Now with your updated kitchen setup"
        />
        <PrimaryButton
          label="Return to Pantry"
          variant="ghost"
          onPress={() => router.replace('/pantry')}
          accessibilityHint="Returns to Pantry without changing your ingredients"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm },
  confirmation: { gap: space.xs, paddingVertical: space.sm },
  returnActions: { gap: space.sm },
});
