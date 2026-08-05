// Row shapes for the tables defined in supabase/migrations/0001_initial_schema.sql.
//
// Hand-written to match that migration. Once the Supabase project exists,
// regenerate with the Supabase CLI and treat the generated file as the source
// of truth; until then, a schema change must be mirrored here or the adapters
// will lie about their input.

import Foundation

struct HouseholdRow: Codable {
    let id: String
    let name: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, name
        case createdAt = "created_at"
    }
}

struct ProfileRow: Codable {
    let id: String
    let householdId: String
    let displayName: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case householdId  = "household_id"
        case displayName  = "display_name"
        case createdAt    = "created_at"
    }
}

struct UserPreferencesRow: Codable {
    let userId: String
    let equipment: [String]
    let allergens: [String]
    let dietary: [String]
    let onboardingDone: Bool
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case userId        = "user_id"
        case equipment, allergens, dietary
        case onboardingDone = "onboarding_done"
        case updatedAt     = "updated_at"
    }
}

/// `skipped` is a weak negative signal, `disliked` a strong one.
/// Keeping them distinct is what lets the engine de-rank one and eliminate the other.
enum FeedbackVerdict: String, Codable {
    case liked, disliked, skipped
}

struct MealFeedbackRow: Codable {
    let userId: String
    let recipeId: String
    let verdict: FeedbackVerdict
    let madeOn: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case userId    = "user_id"
        case recipeId  = "recipe_id"
        case verdict
        case madeOn    = "made_on"
        case createdAt = "created_at"
    }
}

enum InventorySource: String, Codable {
    case manual, photo, staple
    case shoppingList = "shopping_list"
}

struct InventoryRow: Codable {
    let id: String
    let householdId: String
    let ingredientId: String
    let quantity: Double?
    let unit: String?
    let purchasedOn: String?
    let source: InventorySource
    let addedBy: String?
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case householdId  = "household_id"
        case ingredientId = "ingredient_id"
        case quantity, unit
        case purchasedOn  = "purchased_on"
        case source
        case addedBy      = "added_by"
        case updatedAt    = "updated_at"
    }
}
