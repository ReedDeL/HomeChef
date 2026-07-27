import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useShoppingList } from '@/features/shoppingList/useShoppingList';

export default function ShoppingListScreen() {
  const { items, toggleChecked, removeItem } = useShoppingList();

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(item) => item.id.toString()}
      ListEmptyComponent={
        <Text style={styles.empty}>
          Missing ingredients you push from a recipe will show up here, grouped by recipe.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Pressable
            onPress={() => toggleChecked(item.id, !item.checked)}
            style={styles.checkboxRow}
          >
            <View style={[styles.checkbox, !!item.checked && styles.checkboxChecked]} />
            <View>
              <Text style={[styles.name, !!item.checked && styles.nameChecked]}>
                {item.ingredient_name}
              </Text>
              {item.recipe_name && <Text style={styles.recipe}>for {item.recipe_name}</Text>}
            </View>
          </Pressable>
          <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2' },
  list: { padding: 16, gap: 8 },
  empty: { textAlign: 'center', color: '#6B6B6B', marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EAEAE5',
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#1F6F50',
  },
  checkboxChecked: { backgroundColor: '#1F6F50' },
  name: { fontSize: 15, color: '#1A1A1A', textTransform: 'capitalize' },
  nameChecked: { textDecorationLine: 'line-through', color: '#9A9A9A' },
  recipe: { fontSize: 12, color: '#6B6B6B' },
  remove: { color: '#B4232A', fontSize: 13, fontWeight: '600' },
});
