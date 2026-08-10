import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SelectableCard } from '@/components/ui/SelectableCard';
import { Text } from '@/components/ui/Text';
import {
  COMMON_ALLERGENS,
  DIETARY_PRESETS,
  EQUIPMENT_TIERS,
  EXTRA_APPLIANCES,
  useKitchenStore,
  type ThemeMode,
} from '@/store/kitchen';
import { space } from '@/theme/tokens';

const THEME_OPTIONS: readonly {
  id: ThemeMode;
  label: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    id: 'light',
    label: 'Light mode',
    subtitle: 'Warm background with high-contrast text',
    icon: '☀️',
  },
  {
    id: 'dark',
    label: 'Dark mode',
    subtitle: 'Sleek dark surface with vibrant accents',
    icon: '🌙',
  },
  {
    id: 'system',
    label: 'System default',
    subtitle: 'Automatically matches your device settings',
    icon: '⚙️',
  },
];

/**
 * Settings Screen / Window.
 *
 * Allows users to switch theme (Light / Dark / System), customize kitchen
 * equipment, edit safety allergens and dietary restrictions, and view source
 * attributions.
 */
export default function SettingsScreen() {
  const router = useRouter();

  const themeMode = useKitchenStore((state) => state.themeMode);
  const setThemeMode = useKitchenStore((state) => state.setThemeMode);

  const tierId = useKitchenStore((state) => state.tierId);
  const extras = useKitchenStore((state) => state.extras);
  const setTier = useKitchenStore((state) => state.setTier);
  const toggleExtra = useKitchenStore((state) => state.toggleExtra);

  const allergens = useKitchenStore((state) => state.allergens);
  const dietary = useKitchenStore((state) => state.dietary);
  const toggleAllergen = useKitchenStore((state) => state.toggleAllergen);
  const toggleDietary = useKitchenStore((state) => state.toggleDietary);

  const reset = useKitchenStore((state) => state.reset);
  const [resetConfirming, setResetConfirming] = useState(false);

  const handleReset = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Reset all pantry items and onboarding preferences?')) {
        reset();
        router.replace('/(onboarding)/equipment');
      }
    } else {
      Alert.alert(
        'Reset HomeChef',
        'This will clear your pantry items, kitchen setup, and preferences, and restart onboarding.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reset All',
            style: 'destructive',
            onPress: () => {
              reset();
              router.replace('/(onboarding)/equipment');
            },
          },
        ]
      );
    }
  };

  const openSpoonacular = () => {
    Linking.openURL('https://spoonacular.com/food-api');
  };

  return (
    <Screen>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel="Back"
        accessibilityHint="Returns to the previous screen"
        onPress={() => router.back()}
        style={styles.backRow}
      >
        <Text variant="heading" tone="accent">
          ‹ Back
        </Text>
      </Pressable>

      <View style={styles.header}>
        <Text variant="display">Settings</Text>
        <Text variant="body" tone="muted">
          Manage your appearance, kitchen setup, and dietary preferences.
        </Text>
      </View>

      {/* Theme / Appearance Section */}
      <View style={styles.section}>
        <Text variant="heading">Appearance</Text>
        <Text variant="caption" tone="muted">
          Choose how HomeChef looks on your screen.
        </Text>

        <View
          style={styles.group}
          accessibilityRole="radiogroup"
          accessibilityLabel="Appearance theme options"
        >
          {THEME_OPTIONS.map((opt) => (
            <SelectableCard
              key={opt.id}
              title={`${opt.icon}  ${opt.label}`}
              subtitle={opt.subtitle}
              selected={themeMode === opt.id}
              onPress={() => setThemeMode(opt.id)}
              accessibilityHint={`Switches app appearance to ${opt.label}`}
            />
          ))}
        </View>
      </View>

      {/* Kitchen Equipment Section */}
      <View style={styles.section}>
        <Text variant="heading">Kitchen Equipment</Text>
        <Text variant="caption" tone="muted">
          Only recipes matching your appliances are recommended.
        </Text>

        <View
          style={styles.group}
          accessibilityRole="radiogroup"
          accessibilityLabel="Kitchen equipment tier"
        >
          {EQUIPMENT_TIERS.map((tier) => (
            <SelectableCard
              key={tier.id}
              title={tier.label}
              subtitle={tier.subtitle}
              selected={tier.id === tierId}
              onPress={() => setTier(tier.id)}
              accessibilityHint="Sets your primary kitchen setup"
            />
          ))}
        </View>

        <Text variant="bodyStrong">Extra appliances</Text>
        <View style={styles.chipRow}>
          {EXTRA_APPLIANCES.map((appliance) => (
            <Chip
              key={appliance.id}
              label={appliance.label}
              selected={extras.includes(appliance.id)}
              onPress={() => toggleExtra(appliance.id)}
              accessibilityLabel={appliance.label}
              accessibilityHint="Toggles this appliance in your kitchen"
            />
          ))}
        </View>
      </View>

      {/* Allergies and Diet Section */}
      <View style={styles.section}>
        <Text variant="heading">Allergies & Dietary Restrictions</Text>
        <Text variant="caption" tone="muted">
          Hard safety constraints that the engine will never relax.
        </Text>

        <Text variant="bodyStrong">Allergens</Text>
        <View style={styles.chipRow}>
          {COMMON_ALLERGENS.map((allergen) => (
            <Chip
              key={allergen.id}
              label={allergen.label}
              selected={allergens.includes(allergen.id)}
              onPress={() => toggleAllergen(allergen.id)}
              accessibilityLabel={allergen.label}
              accessibilityHint="Recipes containing this are excluded"
            />
          ))}
        </View>

        <Text variant="bodyStrong">Dietary Presets</Text>
        <View style={styles.chipRow}>
          {DIETARY_PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              label={preset.label}
              selected={dietary.includes(preset.id)}
              onPress={() => toggleDietary(preset.id)}
              accessibilityLabel={preset.label}
              accessibilityHint="Filters recipes for this diet"
            />
          ))}
        </View>
      </View>

      {/* Attribution & About Section */}
      <View style={styles.section}>
        <Text variant="heading">About & Attribution</Text>
        <Card variant="alt">
          <Text variant="bodyStrong">HomeChef</Text>
          <Text variant="caption" tone="muted">
            Photo-based meal decision engine. Version 0.1.0
          </Text>
          <Pressable
            accessible
            accessibilityRole="link"
            accessibilityLabel="Recipe data powered by spoonacular"
            accessibilityHint="Opens the Spoonacular website in browser"
            onPress={openSpoonacular}
            style={styles.attributionLink}
          >
            <Text variant="caption" tone="accent">
              Recipe data powered by Spoonacular ↗
            </Text>
          </Pressable>
        </Card>
      </View>

      {/* Danger / Reset Zone */}
      <View style={styles.section}>
        <Text variant="heading">Data & Reset</Text>
        <Text variant="caption" tone="muted">
          Clear your pantry items, kitchen choices, and restart onboarding.
        </Text>
        {resetConfirming ? (
          <View style={styles.confirmRow}>
            <PrimaryButton
              label="Yes, reset everything"
              onPress={handleReset}
              accessibilityHint="Confirms resetting all data"
            />
            <PrimaryButton
              label="Cancel"
              variant="ghost"
              onPress={() => setResetConfirming(false)}
              accessibilityHint="Cancels reset"
            />
          </View>
        ) : (
          <PrimaryButton
            label="Reset all data and onboarding"
            variant="ghost"
            onPress={() => setResetConfirming(true)}
            accessibilityHint="Asks for confirmation to reset all data"
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { minHeight: 44, justifyContent: 'center' },
  header: { gap: space.xs },
  section: { gap: space.sm, marginTop: space.sm },
  group: { gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  attributionLink: { minHeight: 32, justifyContent: 'center', marginTop: space.xs },
  confirmRow: { gap: space.sm },
});
