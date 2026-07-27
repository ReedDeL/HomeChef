import recipeCatalog from '@/data/recipes.json';
import type { BundledRecipe } from '@/data/types';

/** Distinct ingredient names across the bundled catalog — the "browsable list" for manual entry. */
export const KNOWN_INGREDIENTS: string[] = Array.from(
  new Set((recipeCatalog as BundledRecipe[]).flatMap((r) => r.ingredients.map((i) => i.name.toLowerCase())))
).sort();
