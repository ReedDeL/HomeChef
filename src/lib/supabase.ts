import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { storage } from '@/lib/storage';
import type { Database } from '@/types/supabase-generated';

/**
 * The Supabase client.
 *
 * Only these two variables are public. RLS is what protects the data, not the
 * secrecy of the anon key. Gemini stays in Supabase secrets and is read only
 * inside its Edge Function -- never here.
 * See docs/06_API_KEYS_AND_ENV.md.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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
 * Parameterised by the generated schema, so a table or column name that does
 * not exist is a compile error at the call site rather than a runtime
 * PostgREST 400.
 */
let client: SupabaseClient<Database> | null = null;

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Online actions fail loudly only when invoked. Offline catalog startup must
 * stay usable when a local build deliberately omits Supabase configuration.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy .env.example to .env and fill them in.'
    );
  }
  if (client) return client;

  client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: mmkvAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  return client;
}
