import { createMMKV } from 'react-native-mmkv';

/**
 * Synchronous key-value store. Used for the Supabase session and small local
 * UI state. Anything that belongs to the household or needs to sync across
 * devices lives in Postgres, not here.
 */
export const storage = createMMKV({ id: 'homechef-kv' });

export function getJSON<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A corrupt value is not worth crashing over; treat it as absent.
    storage.remove(key);
    return null;
  }
}

export function setJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}
