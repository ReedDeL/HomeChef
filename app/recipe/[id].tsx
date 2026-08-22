import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { IngredientChip } from '@/components/ui/IngredientChip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { OFFLINE_TRANSITIONAL_CATALOG, lookupIngredient } from '@/data/catalog';
import {
  catalogRecipeCache,
  selectCatalogCandidatePreview,
  selectCatalogRecipeDetail,
} from '@/lib/catalog';
import { formatCuisine, formatDuration, formatEquipment } from '@/lib/format';
import { useCatalogRecipeDetail } from '@/lib/queries/catalog';
import { recordDislike, toEnginePreferences, useKitchenStore } from '@/store/kitchen';
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
  const tierId = useKitchenStore((state) => state.tierId);
  const extras = useKitchenStore((state) => state.extras);
  const allergens = useKitchenStore((state) => state.allergens);
  const dietary = useKitchenStore((state) => state.dietary);
  const preferences = useMemo(
    () => toEnginePreferences({ tierId, extras, allergens, dietary }),
    [tierId, extras, allergens, dietary]
  );

  const offlineRecipe = useMemo(
    () => OFFLINE_TRANSITIONAL_CATALOG.find((candidate) => candidate.id === id),
    [id]
  );
  const hostedDetail = useCatalogRecipeDetail(id);

  const recipe = selectCatalogRecipeDetail({
    hostedDetail: hostedDetail.data,
    cachedDetail: catalogRecipeCache.getDetail(id),
    offlineDetail: offlineRecipe,
    preferences,
  });
  const preview = selectCatalogCandidatePreview(catalogRecipeCache.getCandidate(id), preferences);
  const displayedRecipe = recipe ?? preview;

  if (!displayedRecipe) {
    return (
      <Screen>
        <Text variant="title" accessibilityRole="alert">
          {hostedDetail.isPending ? 'Loading recipe details.' : 'Recipe details are unavailable.'}
        </Text>
        <PrimaryButton
          label="Back to results"
          onPress={() => router.back()}
          accessibilityHint="Returns to the previous screen"
        />
      </Screen>
    );
  }

  const canCook = recipe !== null;
  const owned = new Set(pantry);
  const missing = displayedRecipe.ingredients.filter((ingredient) => !owned.has(ingredient.id));

  const steps = displayedRecipe.instructions
    .split(/\r?\n+/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0);

  return (
    <Screen
      footer={
        <PrimaryButton
          label="👨‍🍳 Start cooking"
          onPress={() => router.push(`/cook/${displayedRecipe.id}`)}
          accessibilityHint={
            canCook ? 'Enters step-by-step cook mode' : 'Waits for complete recipe instructions'
          }
          disabled={!canCook}
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

      {displayedRecipe.imageUrl ? (
        <Image
          source={{ uri: displayedRecipe.imageUrl }}
          style={styles.hero}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : null}

      <View style={styles.intro}>
        <Text variant="title">{displayedRecipe.title}</Text>
        <Text variant="caption" tone="muted">
          {formatDuration(displayedRecipe.totalTimeMinutes)} ·{' '}
          {formatEquipment(displayedRecipe.equipmentRequired)}
          {displayedRecipe.cuisine ? ` · ${formatCuisine(displayedRecipe.cuisine)}` : ''}
        </Text>
      </View>

      {missing.length > 0 ? (
        <Card variant="alt">
          <Text variant="heading" tone="near">
            You&apos;re missing {missing.length}
          </Text>
          <View style={styles.chipRow}>
            {missing.map((ingredient) => (
              <IngredientChip key={ingredient.id} id={ingredient.id} onToggle={togglePantryItem} />
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
        {displayedRecipe.ingredients.map((ingredient) => (
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

      {canCook ? (
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
      ) : (
        <View accessible accessibilityRole="alert">
          <Card variant="alt">
            <Text variant="body">
              {hostedDetail.isPending
                ? 'Loading complete cooking steps.'
                : 'Complete cooking steps are unavailable.'}
            </Text>
          </Card>
        </View>
      )}

      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel="Not for me"
        accessibilityHint="Stops suggesting this recipe"
        onPress={() => {
          recordDislike(displayedRecipe.id);
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
