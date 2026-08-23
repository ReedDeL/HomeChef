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

  it('makes private helper schema access explicit and auditable', () => {
    const migration = readFileSync(
      repositoryFile('supabase/migrations/20260823102934_dual_meal_journeys.sql'),
      'utf8'
    );
    const verification = readFileSync(
      repositoryFile('supabase/tests/journey_schema_verification.sql'),
      'utf8'
    );

    expect(migration).toMatch(
      /grant usage on schema private to authenticated;[\s\S]*grant execute on function private\.validate_weekly_plan_payload/
    );
    expect(verification).toContain("has_schema_privilege('authenticated', 'private', 'USAGE')");
    expect(verification).toContain('acl.grantee = 0');
    expect(verification).toMatch(
      /role_row\.rolname = 'authenticated'[\s\S]*acl\.privilege_type = 'USAGE'/
    );
    expect(verification).toContain('acl.grantee <> namespace_row.nspowner');
    expect(verification).toContain("allowed_role.rolname in ('authenticated', 'service_role')");
    expect(verification).toContain('acl.grantee <> p.proowner');
  });

  it('proves exact index shape instead of accepting prefixes', () => {
    const verification = readFileSync(
      repositoryFile('supabase/tests/journey_schema_verification.sql'),
      'utf8'
    );

    expect(verification).not.toMatch(/pg_get_indexdef\([^\n]+\) like/i);
    expect(verification).toContain('index_row.indnkeyatts = cardinality(expected.expressions)');
    expect(verification).toContain('index_row.indnatts = index_row.indnkeyatts');
    expect(verification).toContain('index_row.indpred is null');
    expect(verification).toContain('index_class.relname = expected.index_name');
    expect(verification).toContain("access_method.amname = 'btree'");
  });
});
