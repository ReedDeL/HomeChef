import { BUNDLED_CATALOG, INGREDIENT_VOCABULARY, lookupIngredient } from '@/data/catalog';
import type { IngredientId } from '@/engine/types';
import { COMMON_PANTRY_IDS } from '@/store/kitchen';
import { resolveIngredient } from '@/lib/ingredients/resolve';
import { canonicalSlug, slugify, SYNONYMS } from '@/lib/ingredients/normalize';

/**
 * Enough suggestions to scan and choose from comfortably without overwhelming.
 */
export const DEFAULT_SUGGESTION_COUNT = 16;

/**
 * Maximum number of search results to return for a text query.
 */
export const MAX_SEARCH_RESULTS = 24;

/**
 * Builds a deterministic ranked ingredient suggestion list from the canonical vocabulary.
 *
 * 1. Curated common pantry items (`COMMON_PANTRY_IDS`) come first.
 * 2. Followed by ingredients used in `BUNDLED_CATALOG`, ranked by recipe frequency
 *    (descending), with display name as a deterministic tie-breaker.
 * 3. Followed by any remaining vocabulary ingredients, sorted alphabetically by name.
 *
 * Deduplicated so each canonical ingredient ID appears exactly once.
 */
function buildRankedSuggestionVocabulary(): readonly IngredientId[] {
  const recipeFreq = new Map<IngredientId, number>();
  for (const recipe of BUNDLED_CATALOG) {
    for (const ing of recipe.ingredients) {
      recipeFreq.set(ing.id, (recipeFreq.get(ing.id) ?? 0) + 1);
    }
  }

  const seen = new Set<IngredientId>();
  const ranked: IngredientId[] = [];

  // 1. Common pantry items
  for (const id of COMMON_PANTRY_IDS) {
    if (!seen.has(id) && lookupIngredient(id) !== undefined) {
      seen.add(id);
      ranked.push(id);
    }
  }

  // 2. Catalog ingredients sorted by recipe frequency (descending), then displayName (ascending)
  const catalogIngredients = INGREDIENT_VOCABULARY.filter(
    (entry) => (recipeFreq.get(entry.id) ?? 0) > 0
  ).sort((a, b) => {
    const countA = recipeFreq.get(a.id) ?? 0;
    const countB = recipeFreq.get(b.id) ?? 0;
    if (countB !== countA) return countB - countA;
    return a.displayName.localeCompare(b.displayName);
  });

  for (const entry of catalogIngredients) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      ranked.push(entry.id);
    }
  }

  // 3. Remaining vocabulary entries sorted by displayName
  const remaining = INGREDIENT_VOCABULARY.filter((entry) => !seen.has(entry.id)).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  for (const entry of remaining) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      ranked.push(entry.id);
    }
  }

  return ranked;
}

export const RANKED_SUGGESTION_VOCABULARY: readonly IngredientId[] =
  buildRankedSuggestionVocabulary();

/**
 * Returns a scannable, deterministic set of suggested ingredients not yet in the pantry.
 * As the user adds an ingredient, it is removed and the next eligible candidate is revealed.
 */
export function getReplenishingSuggestions(
  pantry: ReadonlyArray<IngredientId> | ReadonlySet<IngredientId>,
  limit: number = DEFAULT_SUGGESTION_COUNT
): IngredientId[] {
  const owned = pantry instanceof Set ? pantry : new Set(pantry);
  const results: IngredientId[] = [];

  for (const id of RANKED_SUGGESTION_VOCABULARY) {
    if (!owned.has(id)) {
      results.push(id);
      if (results.length >= limit) {
        break;
      }
    }
  }

  return results;
}

/**
 * Search the ingredient vocabulary by name, including synonyms and aliases,
 * excluding owned pantry items.
 */
export function searchIngredientSuggestions(
  query: string,
  pantry: ReadonlyArray<IngredientId> | ReadonlySet<IngredientId>,
  limit: number = MAX_SEARCH_RESULTS
): IngredientId[] {
  const term = query.trim().toLowerCase();
  if (term.length === 0) {
    return getReplenishingSuggestions(pantry, limit);
  }

  const owned = pantry instanceof Set ? pantry : new Set(pantry);
  const results: IngredientId[] = [];
  const seen = new Set<IngredientId>();

  const add = (id: IngredientId | null | undefined) => {
    if (id && !owned.has(id) && !seen.has(id) && lookupIngredient(id) !== undefined) {
      seen.add(id);
      results.push(id);
    }
  };

  // 1. Direct resolution through synonyms and canonical slugs
  const resolved = resolveIngredient(term);
  if (resolved.id) {
    add(resolved.id);
  }

  const slug = slugify(term);
  const canonical = canonicalSlug(term);
  if (canonical) {
    add(canonical);
  }

  for (const [synonymKey, targetId] of Object.entries(SYNONYMS)) {
    if (synonymKey === slug || synonymKey.startsWith(slug)) {
      add(targetId);
    }
  }

  // 2. Prefix matches on display name
  for (const entry of INGREDIENT_VOCABULARY) {
    if (entry.displayName.toLowerCase().startsWith(term)) {
      add(entry.id);
      if (results.length >= limit) return results;
    }
  }

  // 3. Substring matches on display name
  for (const entry of INGREDIENT_VOCABULARY) {
    if (entry.displayName.toLowerCase().includes(term)) {
      add(entry.id);
      if (results.length >= limit) return results;
    }
  }

  return results.slice(0, limit);
}
