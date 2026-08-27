import { useRouter } from 'expo-router';

import { BUNDLED_CATALOG_ATTRIBUTIONS } from '@/data/catalog';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import {
  clearMealPrepReminders,
  requestMealPrepReminderPermission,
} from '@/lib/meal-prep-notifications';
import {
  MEAL_PREP_REMINDER_LEAD_MINUTES,
  type MealPrepReminderLeadMinutes,
} from '@/lib/meal-prep-reminder';
import { trackSettingsUpdated } from '@/lib/analytics';
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

const REMINDER_LEAD_LABELS: Record<MealPrepReminderLeadMinutes, string> = {
  0: 'At cook time',
  10: '10 min early',
  15: '15 min early',
  30: '30 min early',
  60: '60 min early',
};

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

  const mealPrepRemindersEnabled = useKitchenStore((state) => state.mealPrepRemindersEnabled);
  const mealPrepReminderLeadMinutes = useKitchenStore((state) => state.mealPrepReminderLeadMinutes);
  const setMealPrepRemindersEnabled = useKitchenStore((state) => state.setMealPrepRemindersEnabled);
  const setMealPrepReminderLeadMinutes = useKitchenStore(
    (state) => state.setMealPrepReminderLeadMinutes
  );

  const reset = useKitchenStore((state) => state.reset);
  const [resetConfirming, setResetConfirming] = useState(false);

  const updateTheme = (value: ThemeMode) => {
    setThemeMode(value);
    trackSettingsUpdated({ setting: 'theme', value });
  };

  const updateTier = (value: string) => {
    setTier(value);
    trackSettingsUpdated({ setting: 'equipment_tier', value });
  };

  const updateExtra = (value: (typeof extras)[number]) => {
    toggleExtra(value);
    trackSettingsUpdated({ setting: 'extra_appliance', value });
  };

  const updateAllergen = (value: string) => {
    const enabled = !allergens.includes(value);
    toggleAllergen(value);
    trackSettingsUpdated({ setting: 'allergen_filter_enabled', value: enabled });
  };

  const updateDietary = (value: (typeof dietary)[number]) => {
    const enabled = !dietary.includes(value);
    toggleDietary(value);
    trackSettingsUpdated({ setting: 'dietary_filter_enabled', value: enabled });
  };

  const clearReminders = () => {
    clearMealPrepReminders().catch((error: unknown) => {
      console.warn('[notifications] Unable to clear meal-prep reminders', error);
    });
  };

  const confirmReset = () => {
    clearReminders();
    trackSettingsUpdated({ setting: 'reset', value: 'confirmed' });
    reset();
    router.replace('/(onboarding)/equipment');
  };

  const handleReminderToggle = async (enabled: boolean) => {
    if (!enabled) {
      setMealPrepRemindersEnabled(false);
      clearReminders();
      return;
    }

    try {
      const granted = await requestMealPrepReminderPermission();
      if (granted) {
        setMealPrepRemindersEnabled(true);
        return;
      }
    } catch (error: unknown) {
      console.warn('[notifications] Unable to request permission', error);
    }

    setMealPrepRemindersEnabled(false);
    clearReminders();
    Alert.alert(
      'Reminders are off',
      'You can enable notifications for HomeChef in your device settings.'
    );
  };

  const handleReset = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Reset all pantry items and onboarding preferences?')) {
        confirmReset();
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
            onP  const openAttribution = (url: string) => {
    void Linking.openURL(url);
  };

() => {
    Linking.openURL('https://www.themealdb.com');
  };

  return (
    <Screen header={<Header backLabel="Back" fallbackHref="/" />}>
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
          accessibilityHint="Choose light, dark, or follow your system setting"
        >
          {THEME_OPTIONS.map((opt) => (
            <SelectableCard
              key={opt.id}
              title={`${opt.icon}  ${opt.label}`}
              subtitle={opt.subtitle}
              selected={themeMode === opt.id}
              onPress={() => updateTheme(opt.id)}
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
          accessibilityHint="Choose the appliances you can cook with"
        >
          {EQUIPMENT_TIERS.map((tier) => (
            <SelectableCard
              key={tier.id}
              title={tier.label}
              subtitle={tier.subtitle}
              selected={tier.id === tierId}
              onPress={() => updateTier(tier.id)}
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
              onPress={() => updateExtra(appliance.id)}
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
              onPress={() => updateAllergen(allergen.id)}
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
              onPress={() => updateDietary(preset.id)}
              accessibilityLabel={preset.label}
              accessibilityHint="Filters recipes for this diet"
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="heading">Meal-prep reminders</Text>
        <Text variant="caption" tone="muted">
          Get a reminder when a future weekly meal-prep plan needs you to start cooking.
        </Text>
        <View style={styles.reminderToggle}>
          <Text variant="bodyStrong">Start-cooking reminders</Text>
          <Switch
            accessible
            accessibilityRole="switch"
            accessibilityLabel="Meal-prep reminders"
            accessibilityHint="Turns reminders on only for future weekly meal-prep plans"
            accessibilityState={{ checked: mealPrepRemindersEnabled }}
            value={mealPrepRemindersEnabled}
            onValueChange={handleReminderToggle}
          />
        </View>

        {mealPrepRemindersEnabled ? (
          <View
            style={styles.group}
            accessibilityRole="radiogroup"
            accessibilityLabel="How early should meal-prep reminders arrive"
            accessibilityHint="Choose when meal-prep reminders arrive before cooking"
          >
            <Text variant="bodyStrong">Remind me</Text>
            <View style={styles.chipRow}>
              {MEAL_PREP_REMINDER_LEAD_MINUTES.map((minutes) => (
                <Chip
                  key={minutes}
                  label={REMINDER_LEAD_LABELS[minutes]}
                  selected={mealPrepReminderLeadMinutes === minutes}
                  onPress={() => setMealPrepReminderLeadMinutes(minutes)}
                  accessibilityLabel={REMINDER_LEAD_LABELS[minutes]}
                  accessibilityHint="Sets how early meal-prep reminders arrive"
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* Attribution & About Section */}
      <View style={styles.section}>
        <Text variant="heading">About & Attribution</Text>
        <Card variant="alt">
          <Text variant="bodyStrong">HomeChef</Text>
          <Text variant="caption" tone="muted">
            Photo-based meal decision engine. Version 0.1.0
          </Text>
          {BUNDLED_CATALOG_ATTRIBUTIONS.map((source) => (
            <Pressable
              key={source.sourceId}
              accessible
              accessibilityRole="link"
              accessibilityLabel={`${source.title}, ${source.licenseName}`}
              accessibilityHint="Opens the source and license details in a browser"
              onPress={() => openAttribution(source.url)}
              style={styles.attributionLink}
            >
              <Text variant="caption" tone="accent">
                {source.title} · {source.licenseName} ↗
              </Text>
            </Pressable>
          ))}
          <Text variant="caption" tone="muted">
            Each recipe keeps its source, version, license, and attribution metadata.
          </Text>
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
  header: { gap: space.xs },
  section: { gap: space.sm, marginTop: space.sm },
  group: { gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  reminderToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  attributionLink: { minHeight: 32, justifyContent: 'center', marginTop: space.xs },
  confirmRow: { gap: space.sm },
});
