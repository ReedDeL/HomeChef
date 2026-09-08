import { BUNDLED_CATALOG } from '@/data/catalog';

export interface CuisineOption {
  /** The catalog's own value — what the engine matches against. */
  value: string;
  /** What the user reads. */
  label: string;
}

import { normalizeCuisine } from '@/lib/adapters/to-recipe';

export { normalizeCuisine };

/**
 * The cuisine shortlist offered in the app.
 *
 * Curated with canonical cuisine values rather than scattering UI aliases.
 * Expected labels include Italian, Chinese, Thai, Indian, British, French, Spanish,
 * and American when backed by source data.
 *
 * Cuisine is a soft preference and the first thing the relaxation ladder drops
 * after time, so an option omitted here is still reachable — it simply is not
 * offered as a shortcut.
 */
export const CANDIDATES: readonly CuisineOption[] = [
  { value: 'italian', label: 'Italian' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'thai', label: 'Thai' },
  { value: 'indian', label: 'Indian' },
  { value: 'british', label: 'British' },
  { value: 'french', label: 'French' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'american', label: 'American' },
];

/**
 * Validated against the catalog at module load, so only cuisines backed by
 * catalog recipes are displayed, ensuring every visible cuisine has at least one candidate
 * before pantry, time, and hard constraints apply.
 */
export const CUISINE_OPTIONS: readonly CuisineOption[] = CANDIDATES.filter((option) =>
  BUNDLED_CATALOG.some((recipe) => recipe.cuisine === option.value)
);
