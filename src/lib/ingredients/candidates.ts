import type { IngredientId } from '@/engine/types';
import { isTrustedMatch, resolveIngredient, type MatchKind } from '@/lib/ingredients/resolve';

/**
 * Turning raw vision output into a reviewable pantry list.
 *
 * Deliberately free of React, Expo, and Supabase imports — the same reasoning
 * that keeps `src/engine/` pure. This is where the judgement calls live (what
 * counts as trustworthy, what merges with what, what the user is shown first),
 * so it is the part most worth testing, and it tests in milliseconds with no
 * device, network, or API quota. `pantry-photo.ts` holds the I/O.
 */

/** Matches MAX_IMAGES in the analyze-pantry-photo Edge Function. */
export const MAX_PHOTOS = 10;

/**
 * §2.4: below this the model is not trusted without a human looking. It does
 * not gate what is *shown* — everything is shown — it gates what arrives
 * pre-approved.
 */
export const CONFIDENCE_THRESHOLD = 0.7;

export type DetectedUnit = 'grams' | 'milliliters' | 'pieces' | 'cups' | 'unknown';

/** Why a detection could not be mapped to a pantry ingredient. */
export type UnmatchedReason = 'out_of_catalog' | 'misread' | null;

/** The Edge Function's response shape, mirroring the schema in §2.4. */
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
   * A confident, correctly named food can be absent from the recipe-derived
   * vocabulary. It must not be presented as a recognition failure.
   */
  unmatchedReason: UnmatchedReason;
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
      unmatchedReason: classifyUnmatchedReason(resolved.id, item.confidence),
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

function classifyUnmatchedReason(
  ingredientId: IngredientId | null,
  confidence: number
): UnmatchedReason {
  if (ingredientId !== null) return null;
  return confidence >= CONFIDENCE_THRESHOLD ? 'out_of_catalog' : 'misread';
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
    const priorityDifference = reviewPriority(a) - reviewPriority(b);
    if (priorityDifference !== 0) return priorityDifference;
    return a.confidence - b.confidence;
  });
}

function reviewPriority(candidate: PantryCandidate): number {
  // There is no useful correction for a food the catalog cannot cook with, so
  // it belongs after items the user can genuinely decide or correct.
  if (candidate.unmatchedReason === 'out_of_catalog') return 2;
  return candidate.accepted ? 1 : 0;
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
    unmatchedReason: null,
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
