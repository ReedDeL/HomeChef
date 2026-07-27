import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useToast } from '@/components/ToastProvider';
import { getDb } from '@/db/client';
import { getPantryItems } from '@/db/inventory';
import { getRecipeById, type RecipeRow } from '@/db/recipes';
import { dislikeMeal, saveMeal } from '@/db/savedMeals';
import { addMissingIngredientsToShoppingList } from '@/db/shoppingList';

type RecipeDetail = RecipeRow & { ingredients: { ingredient_name: string; measure: string | null }[] };

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [pantryNames, setPantryNames] = useState<Set<string>>(new Set());
  const [stepIndex, setStepIndex] = useState(0);

  const load = useCallback(async () => {
    const db = await getDb();
    const [recipeDetail, pantryItems] = await Promise.all([
      getRecipeById(db, id),
      getPantryItems(db),
    ]);
    setRecipe(recipeDetail as RecipeDetail | null);
    setPantryNames(new Set(pantryItems.map((item) => item.ingredient_name)));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!recipe) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const missingIngredients = recipe.ingredients
    .map((i) => i.ingredient_name)
    .filter((name) => !pantryNames.has(name));

  // Hands-free voice navigation for cook mode is a fast-follow — this ships
  // with tap-to-advance steps so Cook Mode is usable offline from day one.
  const steps = recipe.instructions.split('\n').filter(Boolean);

  const save = async () => {
    const db = await getDb();
    await saveMeal(db, recipe.id);
    showToast('Saved to your meals');
  };

  const dislike = async () => {
    const db = await getDb();
    await dislikeMeal(db, recipe.id);
  };

  const addMissingToShoppingList = async () => {
    const db = await getDb();
    await addMissingIngredientsToShoppingList(db, recipe.id, missingIngredients);
    const count = missingIngredients.length;
    showToast(`Added ${count} ingredient${count === 1 ? '' : 's'} to shopping list`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {recipe.image_url && <Image source={{ uri: recipe.image_url }} style={styles.image} />}
      <Text style={styles.title}>{recipe.name}</Text>
      {recipe.cook_time_minutes != null && (
        <Text style={styles.meta}>{recipe.cook_time_minutes} min</Text>
      )}

      <View style={styles.actionsRow}>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Save meal" onPress={save} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Not for me" variant="secondary" onPress={dislike} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {recipe.ingredients.map((ingredient) => {
          const missing = !pantryNames.has(ingredient.ingredient_name);
          return (
            <Text key={ingredient.ingredient_name} style={[styles.ingredient, missing && styles.ingredientMissing]}>
              {missing ? '• (missing) ' : '• '}
              {ingredient.ingredient_name}
              {ingredient.measure ? ` — ${ingredient.measure}` : ''}
            </Text>
          );
        })}
        {missingIngredients.length > 0 && (
          <PrimaryButton label="Add missing to shopping list" onPress={addMissingToShoppingList} />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Step {steps.length ? stepIndex + 1 : 0} of {steps.length}
        </Text>
        <Text style={styles.step}>{steps[stepIndex]}</Text>
        <View style={styles.actionsRow}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Previous"
              variant="secondary"
              onPress={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Next"
              onPress={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
              disabled={stepIndex >= steps.length - 1}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2' },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  image: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#EAEAE5' },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A1A' },
  meta: { fontSize: 14, color: '#6B6B6B' },
  actionsRow: { flexDirection: 'row', gap: 12 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  ingredient: { fontSize: 15, color: '#1A1A1A', textTransform: 'capitalize' },
  ingredientMissing: { color: '#B45309' },
  step: { fontSize: 16, color: '#1A1A1A', lineHeight: 22 },
});
