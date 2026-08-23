import { BUNDLED_CATALOG } from '@/data/catalog';

export interface CuisineOption {
  /** The catalog's own value — what the engine matches against. */
  value: string;
  /** What the user reads. */
  label: string;
}

/**
 * The cuisine shortlist offered on the home screen.
 *
 * Curated rather than derived, because the catalog's values are not a clean
 * vocabulary: TheMealDB mixes adjectives with country names ("british" beside
 * "france" and "netherlands"), and 209 recipes carry no cuisine at all.
 * Rendering the raw set would put "Norway" and "Netherlands" in front of a
 * user as though they were cuisines.
 *
 * Cuisine is a soft preference and the first thing the relaxation ladder drops
 * after time, so a short list costs nothing — anything omitted here is still
 * reachable, it simply is not offered as a shortcut.
 */
const CANDIDATES: readonly CuisineOption[] = [
  { value: 'italian', label: 'Italian' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'thai', label: 'Thai' },
  { value: 'india', label: 'Indian' },
  { value: 'british', label: 'British' },
  { value: 'france', label: 'French' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'united states', label: 'American' },
];

/**
 * Validated against the catalog at module load, so a cuisine that the pipeline
 * stops emitting disappears from the UI instead of becoming a chip that
 * silently returns nothing.
 */
export const CUISINE_OPTIONS: readonly CuisineOption[] = CANDIDATES.filter((option) =>
  BUNDLED_CATALOG.some((recipe) => recipe.cuisine === option.value)
);
