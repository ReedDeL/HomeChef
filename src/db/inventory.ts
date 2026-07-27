import type { SQLiteDatabase } from 'expo-sqlite';

export interface PantryItemRow {
  id: number;
  ingredient_name: string;
  quantity: number;
  unit: string | null;
  is_staple: number;
  purchase_date: string | null;
  estimated_expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

export async function getPantryItems(db: SQLiteDatabase) {
  return db.getAllAsync<PantryItemRow>(
    'SELECT * FROM pantry_items ORDER BY ingredient_name ASC'
  );
}

export interface AddPantryItemInput {
  ingredientName: string;
  quantity?: number;
  unit?: string | null;
  purchaseDate?: string | null;
  estimatedExpirationDate?: string | null;
}

/** Adds an ingredient, or bumps quantity if it's already in the pantry. */
export async function addPantryItem(db: SQLiteDatabase, input: AddPantryItemInput) {
  const name = input.ingredientName.trim().toLowerCase();
  if (!name) return;

  await db.runAsync(
    `INSERT INTO pantry_items (ingredient_name, quantity, unit, purchase_date, estimated_expiration_date)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(ingredient_name) DO UPDATE SET
       quantity = quantity + excluded.quantity,
       updated_at = datetime('now')`,
    [
      name,
      input.quantity ?? 1,
      input.unit ?? null,
      input.purchaseDate ?? null,
      input.estimatedExpirationDate ?? null,
    ]
  );
}

/** Inventory drift handling: mark an ingredient not-actually-available at meal-selection time. */
export async function removePantryItem(db: SQLiteDatabase, ingredientName: string) {
  await db.runAsync('DELETE FROM pantry_items WHERE ingredient_name = ?', [
    ingredientName.trim().toLowerCase(),
  ]);
}

/** Auto-removal after expiry — call on app foreground / launch. */
export async function removeExpiredPantryItems(db: SQLiteDatabase) {
  await db.runAsync(
    `DELETE FROM pantry_items
     WHERE estimated_expiration_date IS NOT NULL
       AND date(estimated_expiration_date) < date('now')`
  );
}
