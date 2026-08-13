interface AuthStorageBacking {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface SupabaseAuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const PROVIDER_TOKEN_FIELDS = ['provider_token', 'provider_refresh_token'] as const;

function withoutProviderTokens(value: string): string {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return value;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return value;

  const session = { ...parsed } as Record<string, unknown>;
  let changed = false;

  for (const field of PROVIDER_TOKEN_FIELDS) {
    if (Object.hasOwn(session, field)) {
      delete session[field];
      changed = true;
    }
  }

  return changed ? JSON.stringify(session) : value;
}

export function createSupabaseAuthStorage(backing: AuthStorageBacking): SupabaseAuthStorage {
  return {
    getItem: (key) => Promise.resolve(backing.getString(key) ?? null),
    setItem: (key, value) => {
      backing.set(key, withoutProviderTokens(value));
      return Promise.resolve();
    },
    removeItem: (key) => {
      backing.remove(key);
      return Promise.resolve();
    },
  };
}
