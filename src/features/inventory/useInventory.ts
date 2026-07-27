import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getDb } from '@/db/client';
import {
  addPantryItem,
  getPantryItems,
  removeExpiredPantryItems,
  removePantryItem,
  type AddPantryItemInput,
  type PantryItemRow,
} from '@/db/inventory';

export function useInventory() {
  const [items, setItems] = useState<PantryItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const db = await getDb();
    await removeExpiredPantryItems(db);
    setItems(await getPantryItems(db));
  }, []);

  // Refetch every time this screen regains focus, not just on mount — otherwise
  // adding an ingredient elsewhere and navigating back shows stale data.
  useFocusEffect(
    useCallback(() => {
      refresh().finally(() => setLoading(false));
    }, [refresh])
  );

  const addItem = useCallback(
    async (input: AddPantryItemInput) => {
      const db = await getDb();
      await addPantryItem(db, input);
      await refresh();
    },
    [refresh]
  );

  /** Also used for inventory drift: mark "not actually available" at meal-selection time. */
  const removeItem = useCallback(
    async (ingredientName: string) => {
      const db = await getDb();
      await removePantryItem(db, ingredientName);
      await refresh();
    },
    [refresh]
  );

  return { items, loading, addItem, removeItem, refresh };
}
