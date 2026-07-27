/**
 * Relational schema for pantry inventory and the bundled recipe catalog.
 * MMKV (src/lib/storage.ts) handles key-value state instead — onboarding
 * answers, session, cook-mode resume position.
 */
export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS pantry_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_name TEXT NOT NULL UNIQUE,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT,
  is_staple INTEGER NOT NULL DEFAULT 0,
  purchase_date TEXT,
  estimated_expiration_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  cuisine TEXT,
  instructions TEXT NOT NULL,
  image_url TEXT,
  cook_time_minutes INTEGER,
  required_equipment TEXT NOT NULL DEFAULT '[]',
  dietary_tags TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'themealdb'
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  measure TEXT
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
  ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_name
  ON recipe_ingredients(ingredient_name);

CREATE TABLE IF NOT EXISTS saved_meals (
  recipe_id TEXT PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
  first_made_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS disliked_meals (
  recipe_id TEXT PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
  disliked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_name TEXT NOT NULL,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ingredient_name, recipe_id)
);
`;

/** Pantry staples pre-populated on first run; the user can remove any of them. */
export const DEFAULT_STAPLES = [
  'salt',
  'black pepper',
  'olive oil',
  'vegetable oil',
  'garlic powder',
  'sugar',
] as const;
