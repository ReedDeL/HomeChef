// Inventory data access.
//
// Column lists are explicit everywhere — never SELECT *. A generated column
// or new field should not silently widen what the client pulls over the wire.

import Foundation
import Supabase

enum InventoryService {
    private static let columns =
        "id, household_id, ingredient_id, quantity, unit, purchased_on, source, added_by, updated_at"

    static func fetchInventory(householdId: String) async throws -> [InventoryRow] {
        try await supabase
            .from("inventory")
            .select(columns)
            .eq("household_id", value: householdId)
            .order("ingredient_id", ascending: true)
            .execute()
            .value
    }

    struct AddItem {
        let householdId: String
        let ingredientId: String
        var quantity: Double?
        var unit: String?
        var source: InventorySource = .manual
        var addedBy: String?
    }

    /// Upsert, never insert. The unique(household_id, ingredient_id) constraint
    /// enforces "aggregate by ingredient TYPE, not brand": a second carton of
    /// milk increments a quantity, it does not create a second row.
    static func upsertItem(_ item: AddItem) async throws {
        struct Payload: Encodable {
            let household_id: String
            let ingredient_id: String
            let quantity: Double
            let unit: String?
            let source: String
            let added_by: String?
        }

        try await supabase
            .from("inventory")
            .upsert(
                Payload(
                    household_id: item.householdId,
                    ingredient_id: item.ingredientId,
                    quantity: item.quantity ?? 1,
                    unit: item.unit,
                    source: item.source.rawValue,
                    added_by: item.addedBy
                ),
                onConflict: "household_id,ingredient_id"
            )
            .execute()
    }

    /// One-tap "I don't have this" — the drift mitigation.
    /// The pantry is always somewhat wrong; if correcting it is a chore the
    /// recommendations rot and the user leaves.
    static func removeItem(householdId: String, ingredientId: String) async throws {
        try await supabase
            .from("inventory")
            .delete()
            .eq("household_id", value: householdId)
            .eq("ingredient_id", value: ingredientId)
            .execute()
    }
}
