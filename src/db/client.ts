import { type SQLiteDatabase, openDatabaseAsync } from 'expo-sqlite';
import { CREATE_TABLES_SQL, DEFAULT_STAPLES } from '@/db/schema';
import { seedRecipeCatalog } from '@/db/recipes';

let dbPromise: Promise<SQLiteDatabase> | null = null;

/** Opens (once) and migrates the pantry/recipe database. Safe to call repeatedly. */
export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = initDb();
  }
  return dbPromise;
}

async function initDb(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync('homechef.db');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(CREATE_TABLES_SQL);
  await seedDefaultStaples(db);
  await seedRecipeCatalog(db);
  return db;
}

async function seedDefaultStaples(db: SQLiteDatabase) {
  for (const name of DEFAULT_STAPLES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO pantry_items (ingredient_name, quantity, is_staple)
       VALUES (?, 1, 1)`,
      [name]
    );
  }
}
