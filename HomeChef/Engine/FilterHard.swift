// Hard constraints. These eliminate; they are never relaxed.
//
// An allergen leak is a safety incident, and recommending a braise to a
// microwave-only user destroys trust on the first use the whole product
// rests on. Both failure modes are one-way doors, so both filter rather
// than rank.

import Foundation

/// A recipe survives only if every item it requires is owned.
/// `none` is always satisfied — it marks a no-cook recipe.
func isEquipmentSatisfied(required: [Equipment], owned: [Equipment]) -> Bool {
    let ownedSet = Set(owned)
    return required.allSatisfy { $0 == .none || ownedSet.contains($0) }
}

/// Allergen matching is set membership over canonical ids, plus the allergen
/// groups the vocabulary attaches to each ingredient (butter -> dairy).
///
/// Deliberately NOT a substring test. "egg".contains("eggplant") and
/// "nut".contains("coconut") produce false positives that silently hide
/// most of the catalog.
func hasAllergen(recipe: Recipe, allergens: [IngredientId]) -> Bool {
    guard !allergens.isEmpty else { return false }
    let declared = Set(allergens)
    return recipe.ingredients.contains { ing in
        declared.contains(ing.id) ||
        ing.allergenGroups.contains { declared.contains($0) }
    }
}

/// Dietary selections AND together: choosing vegan and gluten-free requires
/// a recipe tagged both. An untagged recipe fails any active restriction —
/// an absent tag is not evidence of compliance, and guessing in the
/// permissive direction is the unsafe one.
func satisfiesDietary(recipe: Recipe, dietary: [DietaryTag]) -> Bool {
    guard !dietary.isEmpty else { return true }
    let tags = Set(recipe.dietaryTags)
    return dietary.allSatisfy { tags.contains($0) }
}
