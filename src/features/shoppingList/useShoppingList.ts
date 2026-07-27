import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getDb } from '@/db/client';
import {
  getShoppingList,
  removeShoppingListItem,
  setShoppingListItemChecked,
  type ShoppingListItemRow,
} from '@/db/shoppingList';

export function useShoppingList() {
  const [items, setItems] = useState<ShoppingListItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setItems(await getShoppingList(db));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().finally(() => setLoading(false));
    }, [refresh])
  );

  const toggleChecked = useCallback(
    async (id: number, checked: boolean) => {
      const db = await getDb();
      await setShoppingListItemChecked(db, id, checked);
      await refresh();
    },
    [refresh]
  );

  const removeItem = useCallback(
    async (id: number) => {
      const db = await getDb();
      await removeShoppingListItem(db, id);
      await refresh();
    },
    [refresh]
  );

  return { items, loading, toggleChecked, removeItem, refresh };
}
