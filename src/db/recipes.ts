import type { SQLiteDatabase } from 'expo-sqlite';
import recipeCatalog from '@/data/recipes.json';
import type { BundledRecipe } from '@/data/types';

const catalog = recipeCatalog as BundledRecipe[];

/** Loads the bundled catalog into SQLite on first run. No-ops after that. */
export async function seedRecipeCatalog(db: SQLiteDatabase) {
  const { count } = (await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM recipes'
  )) ?? { count: 0 };
  if (count > 0) return;

  await db.withTransactionAsync(async () => {
    for (const recipe of catalog) {
      await db.runAsync(
        `INSERT OR IGNORE INTO recipes
          (id, name, category, cuisine, instructions, image_url, cook_time_minutes, required_equipment, dietary_tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recipe.id,
          recipe.name,
          recipe.category,
          recipe.cuisine,
          recipe.instructions,
          recipe.imageUrl,
          recipe.cookTimeMinutes,
          JSON.stringify(recipe.requiredEquipment),
          JSON.stringify(recipe.dietaryTags),
        ]
      );
      for (const ingredient of recipe.ingredients) {
        await db.runAsync(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_name, measure)
           VALUES (?, ?, ?)`,
          [recipe.id, ingredient.name.toLowerCase(), ingredient.measure]
        );
      }
    }
  });
}

export interface RecipeRow {
  id: string;
  name: string;
  category: string | null;
  cuisine: string | null;
  instructions: string;
  image_url: string | null;
  cook_time_minutes: number | null;
  required_equipment: string; // JSON-encoded Equipment[]
  dietary_tags: string; // JSON-encoded DietaryTag[]
}

export async function getRecipeById(db: SQLiteDatabase, id: string) {
  const recipe = await db.getFirstAsync<RecipeRow>('SELECT * FROM recipes WHERE id = ?', [id]);
  if (!recipe) return null;
  const ingredients = await db.getAllAsync<{ ingredient_name: string; measure: string | null }>(
    'SELECT ingredient_name, measure FROM recipe_ingredients WHERE recipe_id = ?',
    [id]
  );
  return { ...recipe, ingredients };
}

export async function getAllRecipes(db: SQLiteDatabase) {
  return db.getAllAsync<RecipeRow>('SELECT * FROM recipes');
}

/** All recipes with their ingredient lists, for feeding the recommendation engine. */
export async function getAllRecipesWithIngredients(db: SQLiteDatabase) {
  const recipes = await getAllRecipes(db);
  const ingredientRows = await db.getAllAsync<{ recipe_id: string; ingredient_name: string }>(
    'SELECT recipe_id, ingredient_name FROM recipe_ingredients'
  );

  const ingredientsByRecipeId = new Map<string, string[]>();
  for (const row of ingredientRows) {
    const list = ingredientsByRecipeId.get(row.recipe_id) ?? [];
    list.push(row.ingredient_name);
    ingredientsByRecipeId.set(row.recipe_id, list);
  }

  return recipes.map((recipe) => ({
    recipe,
    ingredients: ingredientsByRecipeId.get(recipe.id) ?? [],
  }));
}
