/**
 * The web implementation of the key-value store. Metro resolves this file in
 * place of `storage.ts` for the web bundle, which is the point: the native
 * module graph is never reached, so `react-native-mmkv` and
 * `expo-secure-store` are not bundled and cannot fail to resolve.
 *
 * This has to be a separate file rather than a `Platform.OS` branch inside
 * `storage.ts`. That module calls `getOrCreateEncryptionKey()` at module
 * scope, while building the `createMMKV` argument — so it runs on import,
 * before any runtime branch could be evaluated.
 *
 * SECURITY NOTE, and it is a real difference rather than a detail: the browser
 * has no keychain. Native encrypts this store with AES-128 under a key held in
 * the OS keystore; here the values sit in `localStorage` in the clear, readable
 * by any script running on the origin. That is the standard posture for a
 * Supabase web session, but it is not parity with native, and nothing that
 * would be unacceptable in `localStorage` should be written through this
 * interface.
 */

/**
 * `localStorage` is absent when the bundle is evaluated outside a browser —
 * static rendering at export time, or a test runner. Falling back to an
 * in-memory map keeps import-time side effects from throwing; the values are
 * simply not durable, which is correct in both of those contexts.
 */
const memoryFallback = new Map<string, string>();

function backing(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  if (typeof globalThis.localStorage === 'undefined') {
    return {
      getItem: (key: string) => memoryFallback.get(key) ?? null,
      setItem: (key: string, value: string) => void memoryFallback.set(key, value),
      removeItem: (key: string) => void memoryFallback.delete(key),
    };
  }
  return globalThis.localStorage;
}

export const storage = {
  getString(key: string): string | undefined {
    return backing().getItem(key) ?? undefined;
  },
  set(key: string, value: string): void {
    backing().setItem(key, value);
  },
  remove(key: string): void {
    backing().removeItem(key);
  },
};

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
