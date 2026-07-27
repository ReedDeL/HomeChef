import { createMMKV } from 'react-native-mmkv';

/**
 * Fast key-value store for session state, onboarding answers (equipment,
 * allergies, goals), and cook-mode resume position. Relational pantry/recipe
 * data lives in SQLite instead — see src/db.
 */
export const storage = createMMKV({ id: 'homechef-kv' });

export function getJSON<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setJSON<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function remove(key: string): void {
  storage.remove(key);
}
