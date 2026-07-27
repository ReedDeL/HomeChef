import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BucketSection } from '@/components/BucketSection';
import { useRecommendations } from '@/features/recommendation/useRecommendations';
import type { ScoredRecipe } from '@/features/recommendation/types';

const TIME_CRUNCH_MINUTES = 15;

export default function HomeScreen() {
  const { recommendations, loading, maxTimeMinutes, setMaxTimeMinutes } = useRecommendations();

  const openRecipe = (recipe: ScoredRecipe) => router.push(`/recipe/${recipe.id}`);

  const totalResults =
    recommendations.allIngredients.length +
    recommendations.most.length +
    recommendations.some.length +
    recommendations.requiresGroceryList.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable
        onPress={() => setMaxTimeMinutes(maxTimeMinutes ? null : TIME_CRUNCH_MINUTES)}
        style={[styles.timeButton, !!maxTimeMinutes && styles.timeButtonActive]}
      >
        <Text style={[styles.timeButtonLabel, !!maxTimeMinutes && styles.timeButtonLabelActive]}>
          {maxTimeMinutes ? `Showing ≤${maxTimeMinutes} min` : "I don't have enough time"}
        </Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : totalResults === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptyBody}>
            Add a few ingredients to your pantry and we'll tell you what to make.
          </Text>
        </View>
      ) : (
        <>
          <BucketSection
            title="All Ingredients"
            recipes={recommendations.allIngredients}
            onSelectRecipe={openRecipe}
          />
          <BucketSection title="Most" recipes={recommendations.most} onSelectRecipe={openRecipe} />
          <BucketSection title="Some" recipes={recommendations.some} onSelectRecipe={openRecipe} />
          <BucketSection
            title="Requires a Grocery List"
            recipes={recommendations.requiresGroceryList}
            onSelectRecipe={openRecipe}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2' },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  timeButton: {
    borderWidth: 1,
    borderColor: '#1F6F50',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timeButtonActive: { backgroundColor: '#1F6F50' },
  timeButtonLabel: { color: '#1F6F50', fontWeight: '600' },
  timeButtonLabelActive: { color: 'white' },
  empty: { marginTop: 60, alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  emptyBody: { fontSize: 14, color: '#6B6B6B', textAlign: 'center' },
});
