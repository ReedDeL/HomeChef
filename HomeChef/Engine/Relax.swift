// Relaxation is a first-class code path with its own tests, not an error
// handler. Order is fixed and deliberate — cheapest concession first:
//
//   1. Expand the time limit by one tier.
//   2. Drop the cuisine preference.
//   3. Escalate to Tier 2 (reported, executed by the caller).
//   4. Surface `missingFew` as the primary result.
//   5. Widen to `missingSome`.
//
// Equipment, allergens, and dietary restrictions are never relaxed.
// Every concession is reported so the UI can state it out loud.

import Foundation

/// The time tiers offered on the home screen. Widening moves up one at a time.
let timeTiers: [Minutes] = [15, 30, 60, 120]

/// Below this many fully-ready recipes, Tier 1 counts as thin.
let targetReadyCount = 3

struct RelaxedDecision {
    var buckets: [Bucket: [ScoredRecipe]]
    var appliedRelaxations: [Relaxation]
    /// Tier 1 was still thin after soft concessions. The caller — which is
    /// allowed to do I/O — decides whether the other escalation conditions
    /// hold, fetches Tier 2, and calls back in with a merged catalog.
    /// The engine cannot do this itself without becoming async.
    var shouldEscalateTier2: Bool
}

func decideWithRelaxation(
    catalog: [Recipe],
    pantry: Set<IngredientId>,
    prefs: UserPreferences,
    timeLimit: Minutes
) -> RelaxedDecision {
    let base = decide(catalog: catalog, pantry: pantry, prefs: prefs, timeLimit: timeLimit)
    if (base.buckets[.ready] ?? []).count >= targetReadyCount {
        return RelaxedDecision(buckets: base.buckets, appliedRelaxations: [], shouldEscalateTier2: false)
    }

    let found = findFirstNonEmpty(catalog: catalog, pantry: pantry, prefs: prefs, timeLimit: timeLimit)
    let chosen = found ?? Candidate(result: base, timeLimit: timeLimit, cuisineDropped: false)

    var appliedRelaxations: [Relaxation] = []

    // Rung 1 before rung 2: the order is part of the contract.
    if chosen.timeLimit != timeLimit {
        appliedRelaxations.append(.timeWidened(from: timeLimit, to: chosen.timeLimit))
    }
    if chosen.cuisineDropped, let cuisine = prefs.preferredCuisine {
        appliedRelaxations.append(.cuisineDropped(cuisine: cuisine))
    }

    // Rungs 4 and 5: when nothing is fully ready, the next-best bucket
    // becomes the headline result instead of a secondary list.
    let buckets = chosen.result.buckets
    if (buckets[.ready] ?? []).isEmpty {
        if !(buckets[.missingFew] ?? []).isEmpty {
            appliedRelaxations.append(.bucketPromoted(bucket: .missingFew))
        } else if !(buckets[.missingSome] ?? []).isEmpty {
            appliedRelaxations.append(.bucketPromoted(bucket: .missingSome))
        }
    }

    let readyCount = (buckets[.ready] ?? []).count
    return RelaxedDecision(
        buckets: buckets,
        appliedRelaxations: appliedRelaxations,
        shouldEscalateTier2: readyCount < targetReadyCount
    )
}

private struct Candidate {
    let result: DecisionResult
    let timeLimit: Minutes
    let cuisineDropped: Bool
}

/// Walks the concession space in spec order and returns the first combination
/// that yields any result. Searching for the *minimal* concession keeps the
/// UI banner honest: we report widening to 30 minutes, not 120, when 30 worked.
private func findFirstNonEmpty(
    catalog: [Recipe],
    pantry: Set<IngredientId>,
    prefs: UserPreferences,
    timeLimit: Minutes
) -> Candidate? {
    let tiers = [timeLimit] + timeTiers.filter { $0 > timeLimit }
    let cuisineOptions: [Bool] = prefs.preferredCuisine == nil ? [false] : [false, true]

    for cuisineDropped in cuisineOptions {
        var effectivePrefs = prefs
        if cuisineDropped { effectivePrefs.preferredCuisine = nil }

        for tier in tiers {
            let result = decide(catalog: catalog, pantry: pantry, prefs: effectivePrefs, timeLimit: tier)
            if result.buckets.values.contains(where: { !$0.isEmpty }) {
                return Candidate(result: result, timeLimit: tier, cuisineDropped: cuisineDropped)
            }
        }
    }
    return nil
}
