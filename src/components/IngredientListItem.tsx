import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PantryItemRow } from '@/db/inventory';

interface IngredientListItemProps {
  item: PantryItemRow;
  onRemove: () => void;
}

const SOON_THRESHOLD_DAYS = 3;

function daysUntil(dateString: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

export function IngredientListItem({ item, onRemove }: IngredientListItemProps) {
  const daysLeft = item.estimated_expiration_date ? daysUntil(item.estimated_expiration_date) : null;
  const expiringSoon = daysLeft != null && daysLeft <= SOON_THRESHOLD_DAYS;

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.ingredient_name}</Text>
        <Text style={styles.meta}>
          {item.quantity}
          {item.unit ? ` ${item.unit}` : ''}
          {item.is_staple ? ' · staple' : ''}
        </Text>
        {daysLeft != null && (
          <Text style={[styles.expiry, expiringSoon && styles.expiryWarning]}>
            {daysLeft <= 0 ? 'Expires today' : `Expires in ${daysLeft}d`}
          </Text>
        )}
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
  expiry: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  expiryWarning: {
    color: '#B45309',
    fontWeight: '600',
  },
  remove: {
    color: '#B4232A',
    fontSize: 13,
    fontWeight: '600',
  },
});
