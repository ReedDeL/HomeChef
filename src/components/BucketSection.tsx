import { StyleSheet, Text, View } from 'react-native';
import { RecipeCard } from '@/components/RecipeCard';
import type { ScoredRecipe } from '@/features/recommendation/types';

interface BucketSectionProps {
  title: string;
  recipes: ScoredRecipe[];
  onSelectRecipe: (recipe: ScoredRecipe) => void;
}

export function BucketSection({ title, recipes, onSelectRecipe }: BucketSectionProps) {
  if (recipes.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.list}>
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} onPress={() => onSelectRecipe(recipe)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    gap: 10,
  },
});
