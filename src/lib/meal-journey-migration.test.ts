import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function repositoryFile(relativePath: string): string {
  return fileURLToPath(new URL(`../../${relativePath}`, import.meta.url));
}

describe('meal journey SQL safety guards', () => {
  it('uses an unambiguous PostgreSQL RFC3339 timestamp pattern', () => {
    const migration = readFileSync(
      repositoryFile('supabase/migrations/20260823102934_dual_meal_journeys.sql'),
      'utf8'
    );

    expect(migration).toContain("'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}");
    expect(migration).not.toContain('\\\\d');
  });

  it('makes standalone RLS proof setup errors exit nonzero', () => {
    const verification = readFileSync(
      repositoryFile('supabase/tests/rls_verification.sql'),
      'utf8'
    );

    expect(verification.trimStart()).toMatch(/^\\set ON_ERROR_STOP on$/m);
  });
});
