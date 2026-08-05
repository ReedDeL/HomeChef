// Postgres rows in, engine types out.
//
// This file and ToRecipe.swift are the only places that know both worlds.
// The engine never sees a row type; the query layer never sees an engine type.

import Foundation

/// The pantry is a membership test, not a quantity ledger: the engine asks
/// "do you have it", never "how much". A row with quantity 0 or null still
/// counts as present — deleting the row is the signal for "I don't have this".
func toPantrySet(rows: [InventoryRow]) -> Set<IngredientId> {
    Set(rows.map { $0.ingredientId })
}

func toUserPreferences(row: UserPreferencesRow?, feedback: [MealFeedbackRow]) -> UserPreferences {
    var disliked = Set<String>()
    var skipped  = Set<String>()

    for entry in feedback {
        switch entry.verdict {
        case .disliked: disliked.insert(entry.recipeId)
        case .skipped:  skipped.insert(entry.recipeId)
        case .liked:    break
        }
    }

    return UserPreferences(
        // Filtered rather than cast: a value outside the closed enum —
        // written by a stale client or mid-rollout migration — would
        // otherwise reach a hard-constraint filter with no case for it.
        equipment:        keepKnownEquipment(row?.equipment),
        allergens:        row?.allergens ?? [],
        dietary:          keepKnownDietary(row?.dietary),
        dislikedRecipeIds: disliked,
        skippedRecipeIds:  skipped,
        // Chosen per-session on the home screen, not persisted.
        preferredCuisine: nil
    )
}

private func keepKnownEquipment(_ values: [String]?) -> [Equipment] {
    guard let values else { return [] }
    return values.compactMap { Equipment(rawValue: $0) }
}

private func keepKnownDietary(_ values: [String]?) -> [DietaryTag] {
    guard let values else { return [] }
    return values.compactMap { DietaryTag(rawValue: $0) }
}
