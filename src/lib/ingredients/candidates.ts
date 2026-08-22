import type { IngredientId } from '@/engine/types';
import { isTrustedMatch, resolveIngredient, type MatchKind } from '@/lib/ingredients/resolve';

/**
 * Turning raw vision output into a reviewable pantry list.
 *
 * Deliberately free of React, Expo, and Supabase imports — the same reasoning
 * that keeps `src/engine/` pure. This is where the judgement calls live (what
 * counts as trustworthy, what merges with what, what the user is shown first),
 * so it is the part most worth testing, and it tests in milliseconds without
 * device or network state. `pantry-photo.ts` holds the I/O.
 */

/** Matches MAX_IMAGES in the analyze-pantry-photo Edge Function. */
export const MAX_PHOTOS = 10;

/**
 * Below this confidence, the model is not trusted without a human looking. It
 * does not gate what is *shown* — everything is shown — it gates what arrives
 * pre-approved for the pantry.
 */
export const CONFIDENCE_THRESHOLD = 0.7;

export type DetectedUnit = 'grams' | 'milliliters' | 'pieces' | 'cups' | 'unknown';

/** The Edge Function's response shape for detected pantry items. */
export interface DetectedItem {
  name: string;
  quantity: number;
  unit: DetectedUnit;
  confidence: number;
}

export interface PantryCandidate {
  /** Stable across edits, so React keys and selection survive a correction. */
  key: string;
  /** What the model called it, preserved so the user can see the original. */
  detectedName: string;
  quantity: number;
  unit: DetectedUnit;
  confidence: number;
  /** Canonical id, or null when nothing in the vocabulary matched. */
  ingredientId: IngredientId | null;
  displayName: string | null;
  match: MatchKind;
  /**
   * Pre-ticked in the sheet. True only when the model was confident AND the
   * name resolved cleanly — the two failure modes are independent, so both
   * have to pass.
   */
  accepted: boolean;
  /** The user picked this ingredient by hand; stop second-guessing it. */
  corrected: boolean;
}

/** Normalize detections onto canonical ids, merge duplicates, order for review. */
export function toCandidates(items: readonly DetectedItem[]): PantryCandidate[] {
  const candidates: PantryCandidate[] = [];
  /** Canonical id → index in `candidates`, for merging. */
  const seen = new Map<string, number>();

  items.forEach((item, index) => {
    const resolved = resolveIngredient(item.name);

    const candidate: PantryCandidate = {
      key: `${index}-${resolved.id ?? resolved.raw}`,
      detectedName: item.name,
      quantity: item.quantity,
      unit: item.unit,
      confidence: item.confidence,
      ingredientId: resolved.id,
      displayName: resolved.displayName,
      match: resolved.match,
      accepted: item.confidence >= CONFIDENCE_THRESHOLD && isTrustedMatch(resolved.match),
      corrected: false,
    };

    // Two photos of the same shelf, or "onion" and "onions" in one pass, must
    // not become two pantry rows — the schema aggregates by ingredient type,
    // and the sheet should reflect that before the write, not after.
    if (candidate.ingredientId !== null) {
      const existing = seen.get(candidate.ingredientId);
      if (existing !== undefined) {
        candidates[existing] = merge(candidates[existing]!, candidate);
        return;
      }
      seen.set(candidate.ingredientId, candidates.length);
    }

    candidates.push(candidate);
  });

  return sortForReview(candidates);
}

/** Keep the better-evidenced reading, and sum what was counted. */
function merge(existing: PantryCandidate, incoming: PantryCandidate): PantryCandidate {
  const better = incoming.confidence > existing.confidence ? incoming : existing;

  return {
    ...better,
    // Summing across units would produce "502 pieces" from 2 cartons and
    // 500 ml. Only like units add.
    quantity:
      existing.unit === incoming.unit ? existing.quantity + incoming.quantity : better.quantity,
    confidence: Math.max(existing.confidence, incoming.confidence),
    accepted: existing.accepted || incoming.accepted,
  };
}

/**
 * Things needing a decision come first. The user should not have to hunt
 * through twenty correct rows to find the one the machine got wrong.
 */
function sortForReview(candidates: readonly PantryCandidate[]): PantryCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.accepted !== b.accepted) return a.accepted ? 1 : -1;
    if ((a.ingredientId === null) !== (b.ingredientId === null)) {
      return a.ingredientId === null ? -1 : 1;
    }
    return a.confidence - b.confidence;
  });
}

/** Apply a user's correction, which is always trusted over the model. */
export function correctCandidate(
  candidate: PantryCandidate,
  ingredientId: IngredientId,
  displayName: string
): PantryCandidate {
  return {
    ...candidate,
    ingredientId,
    displayName,
    match: 'exact',
    corrected: true,
    accepted: true,
  };
}

/** The ids the user confirmed. The only thing that reaches the pantry. */
export function acceptedIngredientIds(
  candidates: readonly PantryCandidate[]
): readonly IngredientId[] {
  return candidates
    .filter((candidate) => candidate.accepted && candidate.ingredientId !== null)
    .map((candidate) => candidate.ingredientId!);
}
