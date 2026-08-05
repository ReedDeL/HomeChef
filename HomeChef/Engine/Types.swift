// The entire public data contract of the decision engine.
//
// Everything here is plain data — no Supabase, no SwiftUI, no async.
// The data layer converts into these types (Adapters/) and the engine
// never learns where a recipe came from — bundled Tier 1 or live Tier 2.

import Foundation

typealias IngredientId = String
typealias Minutes = Int

/// Closed enumeration. snake_case raw values are canonical — the catalog
/// pipeline emits exactly these strings, making the equipment filter a set
/// operation rather than a string-matching problem.
enum Equipment: String, Codable, CaseIterable, Hashable {
    case microwave
    case stove
    case oven
    case airFryer    = "air_fryer"
    case kettle
    case blender
    case riceCooker  = "rice_cooker"
    case toasterOven = "toaster_oven"
    case none
}

enum DietaryTag: String, Codable, CaseIterable, Hashable {
    case vegetarian
    case vegan
    case glutenFree  = "gluten_free"
    case dairyFree   = "dairy_free"
    case halal
    case kosher
    case pescatarian
    case keto
}

struct RecipeIngredient: Codable {
    let id: IngredientId
    /// Display text as written in the source, e.g. "2 1/2 tbsp".
    let measure: String
    /// Allergen groups this ingredient belongs to, e.g. butter -> ["dairy"].
    /// Attached by the adapter so allergen checking stays a set operation,
    /// not a substring search ("egg" must not match "eggplant").
    let allergenGroups: [IngredientId]
}

struct Recipe: Identifiable {
    let id: String
    let title: String
    let imageUrl: String?
    let cuisine: String?
    let totalTimeMinutes: Minutes
    let equipmentRequired: [Equipment]
    let dietaryTags: [DietaryTag]
    let ingredients: [RecipeIngredient]
    let instructions: String
    /// Which tier supplied this recipe. The engine ignores it entirely; it
    /// exists so the persistence layer can enforce the Spoonacular field
    /// whitelist and the UI can render attribution.
    let source: RecipeSource

    enum RecipeSource: String, Codable {
        case tier1, tier2
    }
}

struct UserPreferences {
    var equipment: [Equipment]
    /// Canonical ingredient ids the user must never be shown.
    var allergens: [IngredientId]
    var dietary: [DietaryTag]
    /// Strong negative signal — suppress permanently.
    var dislikedRecipeIds: Set<String>
    /// Weak negative signal — de-rank, do not eliminate.
    var skippedRecipeIds: Set<String>
    /// Soft preference; the first thing dropped during relaxation after time.
    var preferredCuisine: String?
}

enum Bucket: String, Hashable {
    case ready
    case missingFew  = "missing_few"
    case missingSome = "missing_some"
    case groceryRun  = "grocery_run"
}

struct ScoredRecipe {
    let recipe: Recipe
    let missing: [IngredientId]
    let bucket: Bucket
    let score: Double
}

/// Which soft constraints the engine had to give up to avoid an empty screen.
/// Every one of these is stated out loud in the UI — silent filter changes
/// are how an app teaches a user not to trust it.
///
/// `tier2Escalation` is the one exception: it adds options without removing
/// constraints, so there is nothing to disclose.
enum Relaxation {
    case timeWidened(from: Minutes, to: Minutes)
    case cuisineDropped(cuisine: String)
    case tier2Escalation
    case bucketPromoted(bucket: Bucket)
}

struct DecisionResult {
    var buckets: [Bucket: [ScoredRecipe]]
    var appliedRelaxations: [Relaxation]
}
