// Synchronous key-value store backed by UserDefaults.
//
// Used for small local UI state (e.g., last-selected time limit).
// Anything that belongs to the household or needs to sync across
// devices lives in Supabase Postgres, not here.

import Foundation

enum LocalStorage {
    private static let defaults = UserDefaults.standard

    static func get<T: Decodable>(_ key: String, as type: T.Type = T.self) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            // A corrupt value is not worth crashing over; treat it as absent.
            defaults.removeObject(forKey: key)
            return nil
        }
    }

    static func set<T: Encodable>(_ key: String, value: T) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        defaults.set(data, forKey: key)
    }

    static func remove(_ key: String) {
        defaults.removeObject(forKey: key)
    }
}
