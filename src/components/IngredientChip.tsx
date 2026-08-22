/**
 * The one and only ingredient chip.
 *
 * The UI ingredient-label contract: every ingredient name anywhere in the app is a
 * chip, and every chip is long-pressable for "I don't have this." That long
 * press is the drift mitigation (R3) — the pantry goes stale the moment someone
 * cooks without telling us, and correcting it has to be cheaper than opening
 * the pantry screen. Re-implementing this per screen is how the gesture goes
 * missing on the screen where a user actually notices the drift.
 */

import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import {
  type IngredientChipVariant,
  ingredientChipAccessibility,
  resolveIngredientName,
} from '@/components/ingredient-chip-label';
import type { IngredientId } from '@/engine/types';
import { palette, radius, space, touchTarget, type as typeScale } from '@/theme/tokens';

type Theme = (typeof palette)['light'] | (typeof palette)['dark'];

export type { IngredientChipVariant };

export interface IngredientChipProps {
  id: IngredientId;
  /** Overrides the vocabulary display name. Use only when the source text matters. */
  label?: string;
  /** Display quantity as written, e.g. "2 1/2 tbsp". */
  measure?: string;
  variant?: IngredientChipVariant;
  /** Long press — "I don't have this." Omit on screens where drift is meaningless. */
  onMarkMissing?: (id: IngredientId) => void;
  /** Tap — explicit removal. Only the pantry screen should pass this. */
  onRemove?: (id: IngredientId) => void;
  testID?: string;
}

export function IngredientChip({
  id,
  label,
  measure,
  variant = 'neutral',
  onMarkMissing,
  onRemove,
  testID,
}: IngredientChipProps) {
  const theme = palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const styles = createStyles(theme);

  const name = resolveIngredientName(id, label);
  const a11y = ingredientChipAccessibility(
    name,
    variant,
    measure,
    onMarkMissing !== undefined,
    onRemove !== undefined
  );

  const interactive = onRemove !== undefined || onMarkMissing !== undefined;

  return (
    <Pressable
      accessible
      accessibilityRole={interactive ? 'button' : 'text'}
      accessibilityLabel={a11y.label}
      accessibilityHint={a11y.hint}
      disabled={!interactive}
      onPress={onRemove !== undefined ? () => onRemove(id) : undefined}
      onLongPress={onMarkMissing !== undefined ? () => onMarkMissing(id) : undefined}
      testID={testID}
      style={[styles.chip, variantStyle(styles, variant)]}
    >
      {measure !== undefined && measure.trim() !== '' ? (
        <Text style={[styles.measure, variantTextStyle(styles, variant)]}>{measure}</Text>
      ) : null}
      <Text style={[styles.name, variantTextStyle(styles, variant)]}>{name}</Text>
      {onRemove !== undefined ? (
        // Decorative: the Pressable already announces removal via its hint, so
        // exposing this glyph separately would double-announce the same action.
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={[styles.remove, variantTextStyle(styles, variant)]}>×</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function variantStyle(styles: ReturnType<typeof createStyles>, variant: IngredientChipVariant) {
  switch (variant) {
    case 'pantry':
      return styles.chipPantry;
    case 'missing':
      return styles.chipMissing;
    case 'allergen':
      return styles.chipAllergen;
    case 'neutral':
      return styles.chipNeutral;
  }
}

function variantTextStyle(styles: ReturnType<typeof createStyles>, variant: IngredientChipVariant) {
  return variant === 'allergen' ? styles.textAllergen : styles.textDefault;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      minHeight: touchTarget.standard,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    chipNeutral: { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
    chipPantry: { backgroundColor: theme.surface, borderColor: theme.ready },
    chipMissing: { backgroundColor: theme.surfaceAlt, borderColor: theme.near },
    chipAllergen: { backgroundColor: theme.surface, borderColor: theme.danger },
    name: { ...typeScale.body },
    measure: { ...typeScale.caption, color: theme.textMuted },
    remove: { ...typeScale.bodyStrong, color: theme.textMuted },
    textDefault: { color: theme.text },
    textAllergen: { color: theme.danger },
  });
}
