// Personal data: preferences, allergens, dietary restrictions, and feedback.
// These join to user_id and are structurally unreachable by household members
// — roommates share a pantry, never a diet.

import Foundation
import Supabase

enum PreferencesService {
    // MARK: - Fetch

    static func fetchProfile(userId: String) async throws -> ProfileRow? {
        let rows: [ProfileRow] = try await supabase
            .from("profiles")
            .select("id, household_id, display_name, created_at")
            .eq("id", value: userId)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    static func fetchPreferences(userId: String) async throws -> UserPreferencesRow? {
        let rows: [UserPreferencesRow] = try await supabase
            .from("user_preferences")
            .select("user_id, equipment, allergens, dietary, onboarding_done, updated_at")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    static func fetchFeedback(userId: String) async throws -> [MealFeedbackRow] {
        try await supabase
            .from("meal_feedback")
            .select("user_id, recipe_id, verdict, made_on, created_at")
            .eq("user_id", value: userId)
            .execute()
            .value
    }

    // MARK: - Write

    struct PreferencesUpdate {
        var equipment: [String]?
        var allergens: [String]?
        var dietary: [String]?
        var onboardingDone: Bool?
    }

    static func updatePreferences(userId: String, update: PreferencesUpdate) async throws {
        try await supabase
            .from("user_preferences")
            .upsert(PreferencesPayload(userId: userId, update: update), onConflict: "user_id")
            .execute()
    }

    /// `skipped` is a weak negative signal, `disliked` a strong one.
    /// Keeping them distinct is what lets the engine de-rank one and eliminate the other.
    static func recordVerdict(
        userId: String,
        recipeId: String,
        verdict: FeedbackVerdict
    ) async throws {
        struct Payload: Encodable {
            let user_id: String
            let recipe_id: String
            let verdict: String
        }
        try await supabase
            .from("meal_feedback")
            .upsert(
                Payload(user_id: userId, recipe_id: recipeId, verdict: verdict.rawValue),
                onConflict: "user_id,recipe_id"
            )
            .execute()
    }
}

// MARK: - Private helpers

/// Custom encode so nil fields are omitted from the upsert payload entirely,
/// matching the TypeScript spread-conditional pattern.
private struct PreferencesPayload: Encodable {
    let userId: String
    let update: PreferencesService.PreferencesUpdate

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case equipment, allergens, dietary
        case onboardingDone = "onboarding_done"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(userId, forKey: .userId)
        if let v = update.equipment    { try c.encode(v, forKey: .equipment) }
        if let v = update.allergens    { try c.encode(v, forKey: .allergens) }
        if let v = update.dietary      { try c.encode(v, forKey: .dietary) }
        if let v = update.onboardingDone { try c.encode(v, forKey: .onboardingDone) }
    }
}
