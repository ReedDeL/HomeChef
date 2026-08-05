// The decision engine.
//
// Pure and synchronous over plain data. Takes a [Recipe] and does not know
// or care whether Tier 1 bundled JSON or a Tier 2 live fetch supplied it —
// which is what lets the whole suite run in milliseconds with no device,
// no network, and no API quota.
//
// Hard constraints eliminate; soft constraints rank.

import Foundation

func decide(
    catalog: [Recipe],
    pantry: Set<IngredientId>,
    prefs: UserPreferences,
    timeLimit: Minutes
) -> DecisionResult {
    let survivors = catalog.filter { r in
        // A recipe with no ingredients is a catalog defect, not a zero-effort
        // meal. Admitting it would put it straight into `ready`.
        r.ingredients.count > 0
        && !prefs.dislikedRecipeIds.contains(r.id)
        && isEquipmentSatisfied(required: r.equipmentRequired, owned: prefs.equipment)
        && !hasAllergen(recipe: r, allergens: prefs.allergens)
        && satisfiesDietary(recipe: r, dietary: prefs.dietary)
        && r.totalTimeMinutes <= timeLimit
        && (prefs.preferredCuisine == nil || r.cuisine == prefs.preferredCuisine)
    }

    var buckets = emptyBuckets()
    for recipe in survivors {
        let scored = scoreRecipe(recipe: recipe, pantry: pantry, prefs: prefs, timeLimit: timeLimit)
        buckets[scored.bucket, default: []].append(scored)
    }

    for bucket in bucketOrder {
        buckets[bucket] = (buckets[bucket] ?? [])
            .sorted(by: byScoreThenId)
            .prefix(bucketCap)
            .map { $0 }
    }

    return DecisionResult(buckets: buckets, appliedRelaxations: [])
}

func emptyBuckets() -> [Bucket: [ScoredRecipe]] {
    [.ready: [], .missingFew: [], .missingSome: [], .groceryRun: []]
}

/// Ties break on id so the list does not reshuffle between renders.
private func byScoreThenId(_ a: ScoredRecipe, _ b: ScoredRecipe) -> Bool {
    if a.score != b.score { return a.score > b.score }
    return a.recipe.id < b.recipe.id
}
