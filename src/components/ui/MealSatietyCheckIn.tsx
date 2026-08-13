import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Text } from '@/components/ui/Text';
import { SATIETY_LEVELS, satietyLabel } from '@/lib/meal-satiety';
import type { MealSatietyLevel } from '@/types/database';
import { radius, space, touchTarget } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface MealSatietyCheckInProps {
  recipeTitle: string;
  isSaving: boolean;
  errorMessage: string | null;
  onSave: (level: MealSatietyLevel) => void;
  onSkip: () => void;
}

/**
 * A separate completion decision keeps the meal verdict quick while making
 * the optional personal signal easy to skip.
 */
export function MealSatietyCheckIn({
  recipeTitle,
  isSaving,
  errorMessage,
  onSave,
  onSkip,
}: MealSatietyCheckInProps) {
  const { color } = useTheme();
  const [selectedLevel, setSelectedLevel] = useState<MealSatietyLevel | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <Text variant="display">How full do you feel?</Text>
        <Text variant="body" tone="muted">
          {recipeTitle}
        </Text>
      </View>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="How full do you feel after this meal?"
        style={styles.options}
      >
        {SATIETY_LEVELS.map((level) => {
          const selected = level === selectedLevel;
          const label = satietyLabel(level);

          return (
            <Pressable
              key={level}
              accessible
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityHint={`Records that this meal left you ${label.toLowerCase()}.`}
              accessibilityState={{ selected }}
              onPress={() => setSelectedLevel(level)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? color.surfaceAlt : color.surface,
                  borderColor: selected ? color.accent : color.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.marker,
                  {
                    backgroundColor: color.surface,
                    borderColor: selected ? color.accent : color.border,
                  },
                ]}
              >
                {selected ? (
                  <View style={[styles.markerDot, { backgroundColor: color.accent }]} />
                ) : null}
              </View>
              <Text variant="bodyStrong">{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {errorMessage !== null ? (
        <Text accessibilityLiveRegion="polite" variant="body" tone="muted">
          Couldn’t save your hunger stat. Try again or skip for now.
        </Text>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          label="Save hunger stat"
          disabled={selectedLevel === null || isSaving}
          onPress={() => {
            if (selectedLevel) onSave(selectedLevel);
          }}
          accessibilityHint="Saves how full this meal left you"
        />
        <PrimaryButton
          label="Skip"
          variant="ghost"
          onPress={onSkip}
          accessibilityHint="Returns home without saving a hunger stat"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
  },
  intro: {
    gap: space.xs,
    alignItems: 'center',
  },
  options: {
    gap: space.sm,
  },
  option: {
    minHeight: touchTarget.standard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  marker: {
    width: space.lg,
    height: space.lg,
    padding: space.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  markerDot: {
    flex: 1,
    borderRadius: radius.full,
  },
  actions: {
    gap: space.sm,
  },
});
