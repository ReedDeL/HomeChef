import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { IngredientChip } from '@/components/ui/IngredientChip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TIER1_CATALOG, lookupIngredient } from '@/data/catalog';
import { formatCuisine, formatDuration, formatEquipment } from '@/lib/format';
import {
  trackCookModeStarted,
  trackPantryItemAdded,
  trackPantryItemRemoved,
  trackRecipeDisliked,
  trackRecipeViewed,
} from '@/lib/analytics';
import { recordDislike, useKitchenStore } from '@/store/kitchen';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Spec §6 — the recipe.
 *
 * Ingredients are `IngredientChip`s rather than text, so the correction
 * gesture is available here too. Missing items are called out against the
 * pantry rather than listed neutrally: the question this screen answers is
 * "can I make this right now", not "what is this dish".
 */
export default function RecipeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { color } = useTheme();

  const pantry = useKitchenStore((state) => state.pantry);
  const togglePantryItem = useKitchenStore((state) => state.togglePantryItem);

  const recipe = useMemo(() => TIER1_CATALOG.find((candidate) => candidate.id === id), [id]);

  useEffect(() => {
    if (recipe) trackRecipeViewed({ recipe_id: recipe.id, source: 'results' });
  }, [recipe]);

  const toggleIngredient = (ingredientId: (typeof pantry)[number]) => {
    const adding = !pantry.includes(ingredientId);
    togglePantryItem(ingredientId);
    if (adding) {
      trackPantryItemAdded({ source: 'recipe', item_count: 1 });
    } else {
      trackPantryItemRemoved({ source: 'recipe', item_count: 1 });
    }
  };

  if (!recipe) {
    return (
      <Screen>
        <Text variant="title">That recipe isn&apos;t here.</Text>
        <PrimaryButton
          label="Back to results"
          onPress={() => router.back()}
          accessibilityHint="Returns to the previous screen"
        />
      </Screen>
    );
  }

  const owned = new Set(pantry);
  const missing = recipe.ingredients.filter((ingredient) => !owned.has(ingredient.id));

  const steps = recipe.instructions
    .split(/\r?\n+/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0);

  return (
    <Screen
      footer={
        <PrimaryButton
          label="👨‍🍳 Start cooking"
          onPress={() => {
            trackCookModeStarted({ recipe_id: recipe.id, step_count: steps.length });
            router.push(`/cook/${recipe.id}`);
          }}
          accessibilityHint="Enters step-by-step cook mode"
        />
      }
    >
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel="Back"
        accessibilityHint="Returns to results"
        onPress={() => router.back()}
        style={styles.backRow}
      >
        <Text variant="heading" tone="accent">
          ‹ Back
        </Text>
      </Pressable>

      {recipe.imageUrl ? (
        <Image
          source={{ uri: recipe.imageUrl }}
          style={styles.hero}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : null}

      <View style={styles.intro}>
        <Text variant="title">{recipe.title}</Text>
        <Text variant="caption" tone="muted">
          {formatDuration(recipe.totalTimeMinutes)} · {formatEquipment(recipe.equipmentRequired)}
          {recipe.cuisine ? ` · ${formatCuisine(recipe.cuisine)}` : ''}
        </Text>
      </View>

      {missing.length > 0 ? (
        <Card variant="alt">
          <Text variant="heading" tone="near">
            You&apos;re missing {missing.length}
          </Text>
          <View style={styles.chipRow}>
            {missing.map((ingredient) => (
              <IngredientChip key={ingredient.id} id={ingredient.id} onToggle={toggleIngredient} />
            ))}
          </View>
          <Text variant="caption" tone="muted">
            Tap one if you actually have it.
          </Text>
        </Card>
      ) : (
        <Card variant="alt">
          <Text variant="heading" tone="ready">
            You have everything.
          </Text>
        </Card>
      )}

      <View style={styles.group}>
        <Text variant="heading">Ingredients</Text>
        {recipe.ingredients.map((ingredient) => (
          <View key={ingredient.id} style={styles.ingredientRow}>
            <Text variant="body" style={styles.ingredientName}>
              {lookupIngredient(ingredient.id)?.displayName ?? ingredient.id}
            </Text>
            <Text variant="caption" tone="muted">
              {ingredient.measure}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.group}>
        <Text variant="heading">Steps</Text>
        {steps.map((step, index) => (
          <View key={`${index}-${step.slice(0, 12)}`} style={styles.step}>
            <Text variant="caption" tone="accent">
              {index + 1}
            </Text>
            <Text variant="body" style={styles.stepBody}>
              {step}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel="Not for me"
        accessibilityHint="Stops suggesting this recipe"
        onPress={() => {
          trackRecipeDisliked({ recipe_id: recipe.id });
          recordDislike(recipe.id);
          router.back();
        }}
        style={[styles.dislike, { borderColor: color.border }]}
      >
        <Text variant="caption" tone="muted">
          Not for me — don&apos;t suggest this again
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { minHeight: 44, justifyContent: 'center' },
  hero: { width: '100%', height: 200, borderRadius: radius.md },
  intro: { gap: space.xs },
  group: { gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    minHeight: 32,
  },
  ingredientName: { flex: 1 },
  step: { flexDirection: 'row', gap: space.md },
  stepBody: { flex: 1 },
  dislike: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
