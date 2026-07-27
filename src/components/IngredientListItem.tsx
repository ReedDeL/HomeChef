import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PantryItemRow } from '@/db/inventory';

interface IngredientListItemProps {
  item: PantryItemRow;
  onRemove: () => void;
}

export function IngredientListItem({ item, onRemove }: IngredientListItemProps) {
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.ingredient_name}</Text>
        <Text style={styles.meta}>
          {item.quantity}
          {item.unit ? ` ${item.unit}` : ''}
          {item.is_staple ? ' · staple' : ''}
        </Text>
      </View>
      <Pressable onPress={onRemove} hitSlop={8}>
        <Text style={styles.remove}>Remove</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAE5',
  },
  info: {
    gap: 2,
  },
  name: {
    fontSize: 16,
    color: '#1A1A1A',
    textTransform: 'capitalize',
  },
  meta: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  remove: {
    color: '#B4232A',
    fontSize: 13,
    fontWeight: '600',
  },
});
