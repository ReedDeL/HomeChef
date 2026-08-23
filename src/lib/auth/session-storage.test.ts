import { describe, expect, it } from 'vitest';

import { createSupabaseAuthStorage } from '@/lib/auth/session-storage';

function memoryStorage() {
  const values = new Map<string, string>();

  return {
    values,
    storage: {
      getString: (key: string): string | undefined => values.get(key),
      set: (key: string, value: string): void => void values.set(key, value),
      remove: (key: string): void => void values.delete(key),
    },
  };
}

describe('Supabase auth storage', () => {
  it('persists the Supabase session without OAuth provider tokens', async () => {
    const backing = memoryStorage();
    const authStorage = createSupabaseAuthStorage(backing.storage);

    await authStorage.setItem(
      'supabase-session',
      JSON.stringify({
        access_token: 'supabase-access',
        refresh_token: 'supabase-refresh',
        provider_token: 'google-access',
        provider_refresh_token: 'google-refresh',
        token_type: 'bearer',
      })
    );

    expect(JSON.parse(backing.values.get('supabase-session') ?? '')).toEqual({
      access_token: 'supabase-access',
      refresh_token: 'supabase-refresh',
      token_type: 'bearer',
    });
    await expect(authStorage.getItem('supabase-session')).resolves.toContain(
      '"refresh_token":"supabase-refresh"'
    );
  });
});
