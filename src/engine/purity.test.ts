import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The engine is pure: no React, no imports from src/lib/, no I/O
 * (Technical Spec §4.1; AGENTS.md architecture rules).
 *
 * Code review is a human process that gets skipped at 2am on August 23, so the
 * rule is also asserted here and enforced by ESLint in CI.
 */
const ENGINE_DIR = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN = [
  { pattern: /from\s+['"]react/, why: 'React' },
  { pattern: /from\s+['"]@\/lib\//, why: 'src/lib/ (I/O)' },
  { pattern: /from\s+['"]@supabase\//, why: 'the Supabase client' },
  { pattern: /from\s+['"]@tanstack\//, why: 'TanStack Query' },
  { pattern: /from\s+['"]expo/, why: 'an Expo module' },
  { pattern: /from\s+['"]zustand/, why: 'Zustand' },
];

const sourceFiles = readdirSync(ENGINE_DIR).filter(
  (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.startsWith('__')
);

describe('src/engine/ purity', () => {
  it('has source files to check', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  for (const file of sourceFiles) {
    describe(file, () => {
      const contents = readFileSync(join(ENGINE_DIR, file), 'utf8');

      for (const { pattern, why } of FORBIDDEN) {
        it(`does not import ${why}`, () => {
          expect(pattern.test(contents)).toBe(false);
        });
      }

      // No I/O, no clock, no randomness: the engine must be a deterministic
      // function of its arguments or the buckets are untestable.
      it('performs no I/O and reads no ambient state', () => {
        expect(contents).not.toMatch(/\bfetch\s*\(/);
        expect(contents).not.toMatch(/Math\.random/);
        expect(contents).not.toMatch(/Date\.now|new Date\(/);
        expect(contents).not.toMatch(/process\.env/);
      });
    });
  }
});
