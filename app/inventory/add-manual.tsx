import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { KNOWN_INGREDIENTS } from '@/data/knownIngredients';
import { useInventory } from '@/features/inventory/useInventory';

export default function AddManualScreen() {
  const { addItem } = useInventory();
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [expiresInDays, setExpiresInDays] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return KNOWN_INGREDIENTS.slice(0, 50);
    return KNOWN_INGREDIENTS.filter((name) => name.includes(q)).slice(0, 50);
  }, [query]);

  const exactMatchExists = KNOWN_INGREDIENTS.includes(query.trim().toLowerCase());

  const selectIngredient = (name: string) => {
    setSelectedName(name);
    setQuantity('1');
    setExpiresInDays('');
  };

  const confirmAdd = async () => {
    if (!selectedName) return;
    const days = parseInt(expiresInDays, 10);
    const estimatedExpirationDate =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : null;

    await addItem({
      ingredientName: selectedName,
      quantity: Number.parseFloat(quantity) || 1,
      estimatedExpirationDate,
    });
    router.back();
  };

  if (selectedName) {
    return (
      <View style={styles.container}>
        <Text style={styles.detailTitle}>{selectedName}</Text>

        <Text style={styles.label}>Quantity</Text>
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          style={styles.input}
        />

        <Text style={styles.label}>Expires in how many days? (optional)</Text>
        <TextInput
          value={expiresInDays}
          onChangeText={setExpiresInDays}
          keyboardType="numeric"
          placeholder="e.g. 7"
          style={styles.input}
        />
        <Text style={styles.hint}>
          Leave blank if you don't want an expiration reminder for this item.
        </Text>

        <View style={{ gap: 10, marginTop: 8 }}>
          <PrimaryButton label="Add to pantry" onPress={confirmAdd} />
          <PrimaryButton label="Back" variant="secondary" onPress={() => setSelectedName(null)} />
        </View>
      </View>
    );
  }

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
          <Pressable onPress={() => selectIngredient(item)} style={styles.row}>
            <Text style={styles.rowText}>{item}</Text>
          </Pressable>
        )}
        ListFooterComponent={
          query.trim() && !exactMatchExists ? (
            <Pressable
              onPress={() => selectIngredient(query.trim())}
              style={[styles.row, styles.customRow]}
            >
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
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'capitalize',
    marginBottom: 16,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#6B6B6B', marginBottom: 6 },
  hint: { fontSize: 12, color: '#6B6B6B', marginTop: -8, marginBottom: 8 },
});
