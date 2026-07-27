import type { SQLiteDatabase } from 'expo-sqlite';

export async function saveMeal(db: SQLiteDatabase, recipeId: string) {
  await db.runAsync('INSERT OR IGNORE INTO saved_meals (recipe_id) VALUES (?)', [recipeId]);
  // A like overrides a prior dislike.
  await db.runAsync('DELETE FROM disliked_meals WHERE recipe_id = ?', [recipeId]);
}

export async function unsaveMeal(db: SQLiteDatabase, recipeId: string) {
  await db.runAsync('DELETE FROM saved_meals WHERE recipe_id = ?', [recipeId]);
}

export async function dislikeMeal(db: SQLiteDatabase, recipeId: string) {
  await db.runAsync('INSERT OR IGNORE INTO disliked_meals (recipe_id) VALUES (?)', [recipeId]);
  await db.runAsync('DELETE FROM saved_meals WHERE recipe_id = ?', [recipeId]);
}

export async function getDislikedRecipeIds(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ recipe_id: string }>('SELECT recipe_id FROM disliked_meals');
  return new Set(rows.map((r) => r.recipe_id));
}

export interface SavedMealRow {
  recipe_id: string;
  first_made_at: string;
}

export async function getSavedMeals(db: SQLiteDatabase) {
  return db.getAllAsync<SavedMealRow>('SELECT * FROM saved_meals ORDER BY first_made_at DESC');
}
