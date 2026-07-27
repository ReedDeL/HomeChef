import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KNOWN_INGREDIENTS } from '@/data/knownIngredients';
import { useInventory } from '@/features/inventory/useInventory';

export default function AddManualScreen() {
  const { addItem } = useInventory();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return KNOWN_INGREDIENTS.slice(0, 50);
    return KNOWN_INGREDIENTS.filter((name) => name.includes(q)).slice(0, 50);
  }, [query]);

  const exactMatchExists = KNOWN_INGREDIENTS.includes(query.trim().toLowerCase());

  const handleAdd = async (name: string) => {
    await addItem({ ingredientName: name });
    router.back();
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search ingredients..."
        style={styles.input}
        autoFocus
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => handleAdd(item)} style={styles.row}>
            <Text style={styles.rowText}>{item}</Text>
          </Pressable>
        )}
        ListFooterComponent={
          query.trim() && !exactMatchExists ? (
            <Pressable onPress={() => handleAdd(query.trim())} style={[styles.row, styles.customRow]}>
              <Text style={styles.rowText}>Add "{query.trim()}" as a custom ingredient</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2', padding: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#D0D5CE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'white',
    marginBottom: 12,
  },
  list: { gap: 4, paddingBottom: 24 },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  customRow: { borderWidth: 1, borderColor: '#1F6F50', borderStyle: 'dashed' },
  rowText: { fontSize: 15, textTransform: 'capitalize', color: '#1A1A1A' },
});
