/**
 * Naming and screen-reader text for IngredientChip.
 *
 * Split out of IngredientChip.tsx so it stays importable without React Native.
 * The test runner cannot parse RN's Flow-typed entrypoint, so anything that
 * imports RN is untestable here — and announced text is the part of a chip most
 * likely to regress silently, since nobody sees it in review.
 */

import { lookupIngredient } from '@/data/catalog';
import type { IngredientId } from '@/engine/types';

/**
 * `allergen` is not a severity level the caller picks freely — it is reserved
 * for ingredients matched against the user's declared allergens, because
 * `danger` red must keep meaning "this could hurt you" (tokens.ts).
 */
export type IngredientChipVariant = 'pantry' | 'missing' | 'allergen' | 'neutral';

/**
 * Underscore ids are canonical everywhere else in the system, but they are not
 * language. A chip that reads `achiote_paste` is a bug the user has to decode.
 */
export function resolveIngredientName(id: IngredientId, override?: string): string {
  if (override !== undefined && override.trim() !== '') return override;
  const entry = lookupIngredient(id);
  if (entry !== undefined) return entry.displayName;
  return id.replace(/_/g, ' ');
}

export interface ChipAccessibility {
  label: string;
  hint: string | undefined;
}

export function ingredientChipAccessibility(
  name: string,
  variant: IngredientChipVariant,
  measure: string | undefined,
  canMarkMissing: boolean,
  canRemove: boolean
): ChipAccessibility {
  const measured = measure !== undefined && measure.trim() !== '' ? `${measure} ${name}` : name;

  const label =
    variant === 'allergen'
      ? `${measured}. Contains an allergen you avoid.`
      : variant === 'missing'
        ? `${measured}. Missing from your pantry.`
        : measured;

  const actions: string[] = [];
  if (canRemove) actions.push('Double tap to remove this from your pantry');
  if (canMarkMissing) actions.push("Long press if you don't have this");

  return { label, hint: actions.length > 0 ? actions.join('. ') : undefined };
}
