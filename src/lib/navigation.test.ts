import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { legacyCookRedirectHref, PRIMARY_TABS } from '@/lib/navigation';

function readApp(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../app/${relativePath}`, import.meta.url)), 'utf8');
}

describe('primary navigation contract', () => {
  it('presents exactly Now, Plan, and Pantry in product order with accessible labels', () => {
    expect(PRIMARY_TABS).toEqual([
      {
        name: 'index',
        title: 'Now',
        accessibilityLabel: 'Now, decide what to make',
      },
      {
        name: 'plan',
        title: 'Plan',
        accessibilityLabel: 'Plan, plan your week',
      },
      {
        name: 'pantry',
        title: 'Pantry',
        accessibilityLabel: 'Pantry, what you have',
      },
    ]);
  });
});

describe('retired cook-mode compatibility contract', () => {
  it('redirects legacy cook links to the matching recipe', () => {
    expect(legacyCookRedirectHref('recipe-123')).toEqual({
      pathname: '/recipe/[id]',
      params: { id: 'recipe-123' },
    });
    expect(legacyCookRedirectHref(['recipe-123', 'ignored'])).toEqual({
      pathname: '/recipe/[id]',
      params: { id: 'recipe-123' },
    });
  });

  it('redirects malformed legacy links to the safe app home', () => {
    expect(legacyCookRedirectHref(undefined)).toBe('/');
    expect(legacyCookRedirectHref('   ')).toBe('/');
    expect(legacyCookRedirectHref([])).toBe('/');
  });

  it('keeps full instructions on recipe details without exposing cook mode', () => {
    const recipeSource = readApp('recipe/[id].tsx');
    const legacyCookSource = readApp('cook/[id].tsx');

    expect(recipeSource).toContain('<Text variant="heading">Steps</Text>');
    expect(recipeSource).not.toContain('Start cooking');
    expect(recipeSource).not.toContain('router.push(`/cook/');
    expect(legacyCookSource).toContain('<Redirect href={legacyCookRedirectHref(id)} />');
    expect(legacyCookSource).not.toContain('CookModeScreen');
  });
});
