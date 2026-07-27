import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { IngredientListItem } from '@/components/IngredientListItem';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useInventory } from '@/features/inventory/useInventory';

export default function InventoryScreen() {
  const { items, removeItem } = useInventory();

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Add manually" onPress={() => router.push('/inventory/add-manual')} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label="Scan photo"
            variant="secondary"
            onPress={() => router.push('/inventory/scan-photo')}
          />
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Your pantry is empty. Add something to get started.</Text>
        }
        renderItem={({ item }) => (
          <IngredientListItem item={item} onRemove={() => removeItem(item.ingredient_name)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2' },
  actions: { flexDirection: 'row', gap: 12, padding: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { textAlign: 'center', color: '#6B6B6B', marginTop: 40 },
});
