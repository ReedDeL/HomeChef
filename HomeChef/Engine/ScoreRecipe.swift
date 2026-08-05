// Scoring weights are reasoned, not fitted — revisit after user-testing.
//
// Bucketing is by missing count, so score only orders recipes WITHIN a bucket.
// Coverage dominates because it is the user's actual question. The skip
// penalty outweighs a marginal coverage gain because an explicit skip is
// the only negative signal the user volunteers; a disliked recipe never
// reaches scoring at all, since decide() eliminates it outright.

import Foundation

enum ScoringWeights {
    static let coverage:     Double = 0.6
    static let timeFit:      Double = 0.25
    static let cuisineMatch: Double = 0.15
    static let skipPenalty:  Double = 0.3
}

func scoreRecipe(
    recipe: Recipe,
    pantry: Set<IngredientId>,
    prefs: UserPreferences,
    timeLimit: Minutes
) -> ScoredRecipe {
    let missing = recipe.ingredients
        .filter { !pantry.contains($0.id) }
        .map { $0.id }

    let total = recipe.ingredients.count
    let coverage: Double = total == 0 ? 0 : Double(total - missing.count) / Double(total)

    // Clamped so a recipe surfaced by time relaxation cannot drive the score
    // arbitrarily negative.
    let timeFit: Double = timeLimit <= 0
        ? 0
        : clamp01(1 - Double(recipe.totalTimeMinutes) / Double(timeLimit))

    let cuisineMatch: Double =
        prefs.preferredCuisine != nil && recipe.cuisine == prefs.preferredCuisine ? 1 : 0

    let skipped: Double = prefs.skippedRecipeIds.contains(recipe.id) ? 1 : 0

    let score = ScoringWeights.coverage     * coverage
              + ScoringWeights.timeFit      * timeFit
              + ScoringWeights.cuisineMatch * cuisineMatch
              - ScoringWeights.skipPenalty  * skipped

    return ScoredRecipe(
        recipe: recipe,
        missing: missing,
        bucket: bucketFor(missingCount: missing.count),
        score: score
    )
}

private func clamp01(_ n: Double) -> Double {
    min(1, max(0, n))
}
