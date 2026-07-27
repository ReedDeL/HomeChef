import type { SQLiteDatabase } from 'expo-sqlite';

export interface ShoppingListItemRow {
  id: number;
  ingredient_name: string;
  recipe_id: string | null;
  recipe_name: string | null;
  checked: number;
  added_at: string;
}

/** Grouped by recipe, de-duplicated across recipes via the UNIQUE(ingredient_name, recipe_id) constraint. */
export async function getShoppingList(db: SQLiteDatabase) {
  return db.getAllAsync<ShoppingListItemRow>(
    `SELECT sl.id, sl.ingredient_name, sl.recipe_id, r.name as recipe_name, sl.checked, sl.added_at
     FROM shopping_list_items sl
     LEFT JOIN recipes r ON r.id = sl.recipe_id
     ORDER BY sl.recipe_id, sl.ingredient_name`
  );
}

export async function addMissingIngredientsToShoppingList(
  db: SQLiteDatabase,
  recipeId: string,
  ingredientNames: string[]
) {
  await db.withTransactionAsync(async () => {
    for (const name of ingredientNames) {
      await db.runAsync(
        `INSERT OR IGNORE INTO shopping_list_items (ingredient_name, recipe_id)
         VALUES (?, ?)`,
        [name.trim().toLowerCase(), recipeId]
      );
    }
  });
}

export async function setShoppingListItemChecked(db: SQLiteDatabase, id: number, checked: boolean) {
  await db.runAsync('UPDATE shopping_list_items SET checked = ? WHERE id = ?', [
    checked ? 1 : 0,
    id,
  ]);
}

export async function removeShoppingListItem(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM shopping_list_items WHERE id = ?', [id]);
}
