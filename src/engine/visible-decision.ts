import { BUCKET_ORDER } from '@/engine/bucket';
import type { DecisionResult, VisibleDecision } from '@/engine/types';

const DECISION_SURFACE_CAP = 4;

export function toVisibleDecision(
  result: DecisionResult,
  limit = DECISION_SURFACE_CAP
): VisibleDecision {
  const buckets: VisibleDecision['buckets'] = {};
  let remaining = Math.min(DECISION_SURFACE_CAP, Math.max(0, Math.floor(limit)));

  for (const bucket of BUCKET_ORDER) {
    if (remaining === 0) break;

    const recipes = result.buckets[bucket].slice(0, remaining);
    if (recipes.length === 0) continue;

    buckets[bucket] = recipes;
    remaining -= recipes.length;
  }

  return {
    buckets,
    appliedRelaxations: [...result.appliedRelaxations],
  };
}
