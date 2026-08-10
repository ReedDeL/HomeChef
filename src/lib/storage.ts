// Hermes has no global `crypto`. This polyfill installs `crypto.getRandomValues`
// as a side effect and must be imported before `getOrCreateEncryptionKey` runs
// at module scope below, so it stays the first import in this file.
import 'react-native-get-random-values';

import { createMMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';

const ENCRYPTION_KEY_ALIAS = 'homechef-mmkv-encryption-key';

/**
 * Returns a 16-byte hex key for MMKV AES-128 encryption, creating one on first
 * launch. The key itself is stored in the OS keychain (Keychain Services on iOS,
 * Android Keystore on Android) via expo-secure-store, so it is never on disk in
 * the clear — even on a rooted device the attacker needs the hardware-backed
 * keystore to decrypt MMKV.
 */
function getOrCreateEncryptionKey(): string {
  const existing = SecureStore.getItem(ENCRYPTION_KEY_ALIAS);
  if (existing) return existing;

  // 16 hex chars = 8 random bytes, which is the max key length for AES-128.
  const key = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  SecureStore.setItem(ENCRYPTION_KEY_ALIAS, key);
  return key;
}

/**
 * Synchronous key-value store. Used for the Supabase session and small local
 * UI state. Anything that belongs to the household or needs to sync across
 * devices lives in Postgres, not here.
 *
 * Encrypted at rest with AES-128. The encryption key lives in the OS keychain,
 * not on disk — see `getOrCreateEncryptionKey`.
 */
export const storage = createMMKV({
  id: 'homechef-kv',
  encryptionKey: getOrCreateEncryptionKey(),
});

export function getJSON<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A corrupt value is not worth crashing over; treat it as absent.
    // Log before deleting so the evidence is not silently destroyed.
    console.warn(`[storage] Removing corrupt value for key "${key}"`);
    storage.remove(key);
    return null;
  }
}

export function setJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}
