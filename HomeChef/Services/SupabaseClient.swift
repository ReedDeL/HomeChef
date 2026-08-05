// Supabase client singleton.
//
// Add the Swift package: https://github.com/supabase/supabase-swift
// Product: Supabase
//
// Only these two values are public. RLS is what protects the data, not the
// secrecy of the anon key. Third-party API keys (Gemini, Spoonacular) live
// in Supabase secrets and are read only inside Edge Functions — never here.
// See docs/06_API_KEYS_AND_ENV.md.
//
// In Xcode: add SUPABASE_URL and SUPABASE_ANON_KEY to a .xcconfig file,
// reference them from Info.plist, and gitignore the .xcconfig.

import Foundation
import Supabase

let supabase: SupabaseClient = {
    guard
        let url = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
        let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
        let supabaseURL = URL(string: url),
        !key.isEmpty
    else {
        // Deliberately loud. A placeholder fallback here would turn a missing
        // config into opaque network errors at the first query, which is far
        // harder to diagnose than failing at startup with the variable name.
        fatalError(
            "Missing SUPABASE_URL or SUPABASE_ANON_KEY in Info.plist. " +
            "See docs/06_API_KEYS_AND_ENV.md."
        )
    }
    return SupabaseClient(supabaseURL: supabaseURL, supabaseKey: key)
}()
