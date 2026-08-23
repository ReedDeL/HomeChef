import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { storage } from '@/lib/storage';
import type { Database } from '@/types/supabase-journeys';

/**
 * The Supabase client.
 *
 * Only these two variables are public. RLS is what protects the data, not the
 * secrecy of the anon key. Third-party API keys (Gemini, Spoonacular) live in
 * Supabase secrets and are read only inside Edge Functions -- never here.
 * See docs/06_API_KEYS_AND_ENV.md.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Deliberately loud. A placeholder fallback here would turn a missing .env
  // into opaque network errors at the first query, which is far harder to
  // diagnose than failing at startup with the name of the missing variable.
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill them in.'
  );
}

/** MMKV is synchronous; Supabase expects promises. */
const mmkvAuthStorage = {
  getItem: (key: string): Promise<string | null> => Promise.resolve(storage.getString(key) ?? null),
  setItem: (key: string, value: string): Promise<void> => {
    storage.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    storage.remove(key);
    return Promise.resolve();
  },
};

/**
 * Parameterised by the generated schema plus the temporary journey overlay,
 * so a table or column name that does not exist remains a compile error rather
 * than a runtime PostgREST 400.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mmkvAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Native has no URL to parse a session from. The web build does — OAuth
    // and magic-link redirects come back with the session in the fragment, and
    // leaving this false there would silently drop every sign-in.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
