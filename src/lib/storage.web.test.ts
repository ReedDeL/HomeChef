import { afterEach, describe, expect, it, vi } from 'vitest';

import { getJSON, setJSON, storage } from '@/lib/storage.web';

afterEach(() => {
  storage.remove('k');
  vi.restoreAllMocks();
});

describe('web storage', () => {
  it('round-trips a string', () => {
    storage.set('k', 'value');
    expect(storage.getString('k')).toBe('value');
  });

  it('returns undefined for a missing key rather than null', () => {
    // Matches the MMKV signature the native module exposes, so callers do not
    // need to know which platform they are on.
    expect(storage.getString('absent')).toBeUndefined();
  });

  it('round-trips JSON', () => {
    setJSON('k', { a: 1, b: ['two'] });
    expect(getJSON<{ a: number; b: string[] }>('k')).toEqual({ a: 1, b: ['two'] });
  });

  it('treats a corrupt value as absent and clears it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    storage.set('k', '{not json');

    expect(getJSON('k')).toBeNull();
    expect(storage.getString('k')).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('falls back to memory when localStorage is unavailable', () => {
    // The state during static export, where the bundle is evaluated in Node.
    // Import-time writes must not throw; they simply are not durable.
    const original = globalThis.localStorage;
    // @ts-expect-error - deleting a global for the duration of one assertion.
    delete globalThis.localStorage;

    expect(() => storage.set('k', 'v')).not.toThrow();
    expect(storage.getString('k')).toBe('v');

    globalThis.localStorage = original;
  });
});
