import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSavedMeals } from '@/features/savedMeals/useSavedMeals';

export default function SavedScreen() {
  const { meals, removeSavedMeal } = useSavedMeals();

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={meals}
      keyExtractor={(item) => item.recipe_id}
      ListEmptyComponent={
        <Text style={styles.empty}>Meals you like will show up here.</Text>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/recipe/${item.recipe_id}`)} style={styles.card}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.date}>
            First made {new Date(item.first_made_at).toLocaleDateString()}
          </Text>
          {item.missingIngredients.length > 0 && (
            <Text style={styles.missing} numberOfLines={1}>
              Still need: {item.missingIngredients.join(', ')}
            </Text>
          )}
          <Pressable onPress={() => removeSavedMeal(item.recipe_id)} hitSlop={8}>
            <Text style={styles.remove}>Unsave</Text>
          </Pressable>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2' },
  list: { padding: 16, gap: 10 },
  empty: { textAlign: 'center', color: '#6B6B6B', marginTop: 40 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: '#EAEAE5',
  },
  name: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  date: { fontSize: 12, color: '#6B6B6B' },
  missing: { fontSize: 12, color: '#B45309' },
  remove: { color: '#B4232A', fontSize: 13, fontWeight: '600', marginTop: 4 },
});
