import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScoredRecipe } from '@/features/recommendation/types';

interface RecipeCardProps {
  recipe: ScoredRecipe;
  onPress: () => void;
}

export function RecipeCard({ recipe, onPress }: RecipeCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      {recipe.imageUrl ? (
        <Image source={{ uri: recipe.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {recipe.name}
        </Text>
        <View style={styles.metaRow}>
          {recipe.cookTimeMinutes != null && (
            <Text style={styles.meta}>{recipe.cookTimeMinutes} min</Text>
          )}
          <Text style={styles.meta}>
            {recipe.matchedIngredientCount}/{recipe.totalIngredientCount} ingredients
          </Text>
        </View>
        {recipe.missingIngredients.length > 0 && (
          <Text style={styles.missing} numberOfLines={1}>
            Missing: {recipe.missingIngredients.join(', ')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EAEAE5',
  },
  image: {
    width: 88,
    height: 88,
  },
  imagePlaceholder: {
    backgroundColor: '#EAEAE5',
  },
  body: {
    flex: 1,
    padding: 10,
    gap: 4,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  meta: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  missing: {
    fontSize: 12,
    color: '#B45309',
  },
});
