import { useRouter } from 'expo-router';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SelectableCard } from '@/components/ui/SelectableCard';
import { Text } from '@/components/ui/Text';
import {
  APPLIANCE_SECTION_DESCRIPTION,
  APPLIANCE_SECTION_TITLE,
  EQUIPMENT_TIERS,
  EXTRA_APPLIANCES,
  useKitchenStore,
} from '@/store/kitchen';
import { space } from '@/theme/tokens';

/**
 * Dedicated kitchen management. Equipment is a hard engine constraint, so
 * updates go straight to the local store and are reflected by Now and Plan on
 * their next render. Pantry and preference state deliberately has no role in
 * these handlers: changing a kitchen does not mean starting over.
 */
export default function KitchenSetupScreen() {
  const router = useRouter();
  const tierId = useKitchenStore((state) => state.tierId);
  const extras = useKitchenStore((state) => state.extras);
  const setTier = useKitchenStore((state) => state.setTier);
  const toggleExtra = useKitchenStore((state) => state.toggleExtra);

  const updateTier = (nextTierId: string) => {
    setTier(nextTierId);
    const tier = EQUIPMENT_TIERS.find((candidate) => candidate.id === nextTierId);
    AccessibilityInfo.announceForAccessibility(
      `Kitchen setup updated to ${tier?.label ?? 'your selected setup'}.`
    );
  };

  const updateExtra = (equipment: (typeof EXTRA_APPLIANCES)[number]['id']) => {
    const appliance = EXTRA_APPLIANCES.find((candidate) => candidate.id === equipment);
    const wasSelected = extras.includes(equipment);
    toggleExtra(equipment);
    AccessibilityInfo.announceForAccessibility(
      appliance
        ? `${appliance.label} ${wasSelected ? 'removed from' : 'added to'} your kitchen.`
        : 'Kitchen appliances updated.'
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
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
          Update what you can cook with at any time. Changes save automatically.
        </Text>
        <Text variant="caption" tone="muted">
          Your pantry, dietary restrictions, allergens, saved choices, and history stay exactly as
          they are.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="heading">Primary equipment</Text>
        <View
          style={styles.group}
          accessibilityRole="radiogroup"
          accessibilityLabel="Primary kitchen equipment"
          accessibilityHint="Choose the equipment available for cooking"
        >
          {EQUIPMENT_TIERS.map((tier) => (
            <SelectableCard
              key={tier.id}
              title={tier.label}
              subtitle={tier.subtitle}
              selected={tier.id === tierId}
              onPress={() => updateTier(tier.id)}
              accessibilityHint="Updates cookable recipe constraints without changing pantry items"
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="heading">{APPLIANCE_SECTION_TITLE}</Text>
        <Text variant="caption" tone="muted">
          {APPLIANCE_SECTION_DESCRIPTION}
        </Text>
        <View
          style={styles.chipRow}
          accessibilityLabel="Additional kitchen appliances"
          accessibilityHint="Select any additional appliances you use"
        >
          {EXTRA_APPLIANCES.map((appliance) => (
            <Chip
              key={appliance.id}
              label={appliance.label}
              selected={extras.includes(appliance.id)}
              onPress={() => updateExtra(appliance.id)}
              accessibilityLabel={appliance.label}
              accessibilityHint="Adds or removes this appliance from your kitchen"
              accessibilityRole="checkbox"
            />
          ))}
        </View>
      </View>

      <View
        style={styles.confirmation}
        accessibilityHint="Confirms your kitchen changes are saved on this device"
        accessibilityLiveRegion="polite"
        accessibilityLabel="Kitchen setup changes save automatically"
      >
        <Text variant="bodyStrong">Saved automatically</Text>
        <Text variant="caption" tone="muted">
          Now and Plan will use these equipment choices the next time they show recommendations.
        </Text>
      </View>

      <View style={styles.returnActions}>
        <Text variant="heading">Where would you like to go?</Text>
        <PrimaryButton
          label="Return to Cook"
          onPress={() => router.replace('/(tabs)')}
          accessibilityHint="Returns to Cook and uses your updated kitchen setup"
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
  section: { gap: space.sm },
  group: { gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  confirmation: { gap: space.xs, paddingVertical: space.sm },
  returnActions: { gap: space.sm },
});
