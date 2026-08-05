// The seam between the database and the decision engine.
//
// Everything asynchronous happens in load() before the engine is called.
// The adapters convert rows into plain engine types, then decideWithRelaxation()
// runs synchronously in recompute(). That is what keeps the whole engine
// testable with no device, no network, and no Supabase project.

import Foundation
import Observation

@Observable
final class DecisionViewModel {
    var decision: RelaxedDecision?
    var isLoading = false
    var householdId: String?
    var error: Error?

    private var inventory:       [InventoryRow]       = []
    private var preferencesRow:  UserPreferencesRow?
    private var feedback:        [MealFeedbackRow]    = []

    // MARK: - Public

    /// Fetch all data for the given user, then run the engine.
    /// Call again whenever timeLimit or preferredCuisine changes — the
    /// network data is cached in properties, so only recompute() fires.
    func load(
        userId: String,
        catalog: [Recipe],
        timeLimit: Minutes,
        preferredCuisine: String? = nil
    ) async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            // Fetch profile, preferences, and feedback concurrently.
            async let profileFetch    = PreferencesService.fetchProfile(userId: userId)
            async let prefsFetch      = PreferencesService.fetchPreferences(userId: userId)
            async let feedbackFetch   = PreferencesService.fetchFeedback(userId: userId)

            let (profile, prefs, fb) = try await (profileFetch, prefsFetch, feedbackFetch)
            self.preferencesRow = prefs
            self.feedback       = fb
            self.householdId    = profile?.householdId

            if let hid = profile?.householdId {
                self.inventory = try await InventoryService.fetchInventory(householdId: hid)
            }

            recompute(catalog: catalog, timeLimit: timeLimit, preferredCuisine: preferredCuisine)
        } catch {
            self.error    = error
            self.decision = nil
        }
    }

    /// Re-run the pure engine without touching the network.
    /// Call when timeLimit or preferredCuisine changes after the initial load.
    func recompute(catalog: [Recipe], timeLimit: Minutes, preferredCuisine: String? = nil) {
        let pantry = toPantrySet(rows: inventory)
        var prefs  = toUserPreferences(row: preferencesRow, feedback: feedback)
        prefs.preferredCuisine = preferredCuisine

        // Before sign-in, fall back to equipment the user chose in onboarding
        // (saved to LocalStorage). Without this, every recipe requiring
        // equipment would be filtered out on first launch.
        if prefs.equipment.isEmpty {
            let saved: [String] = LocalStorage.get("equipment") ?? []
            prefs.equipment = saved.compactMap { Equipment(rawValue: $0) }
        }
        // If still empty (skipped onboarding / fresh simulator), assume full kitchen.
        if prefs.equipment.isEmpty {
            prefs.equipment = [.microwave, .stove, .oven]
        }

        let saved: [String] = LocalStorage.get("dietary") ?? []
        if prefs.dietary.isEmpty {
            prefs.dietary = saved.compactMap { DietaryTag(rawValue: $0) }
        }

        decision = decideWithRelaxation(
            catalog: catalog,
            pantry: pantry,
            prefs: prefs,
            timeLimit: timeLimit
        )
    }
}
