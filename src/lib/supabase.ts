import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { storage } from '@/lib/storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    'Supabase env vars are missing. Copy .env.example to .env and fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

// Reuses the MMKV instance already in the stack instead of pulling in
// async-storage just for Supabase session persistence.
const mmkvAuthStorage = {
  getItem: (key: string) => Promise.resolve(storage.getString(key) ?? null),
  setItem: (key: string, value: string) => {
    storage.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    storage.remove(key);
    return Promise.resolve();
  },
};

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: mmkvAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
