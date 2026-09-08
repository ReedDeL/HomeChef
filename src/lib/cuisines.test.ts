import { describe, expect, it } from 'vitest';
import { BUNDLED_CATALOG } from '@/data/catalog';
import { CANDIDATES, CUISINE_OPTIONS, normalizeCuisine } from '@/lib/cuisines';
import { decide } from '@/engine/decide';
import { toEnginePreferences } from '@/store/kitchen';
import { decideWithRelaxation } from '@/engine/relax';

describe('normalizeCuisine', () => {
  it('normalizes common nationality adjectives and country names to canonical slugs', () => {
    expect(normalizeCuisine('American')).toBe('american');
    expect(normalizeCuisine('american')).toBe('american');
    expect(normalizeCuisine('United States')).toBe('american');
    expect(normalizeCuisine('united states')).toBe('american');
    expect(normalizeCuisine('USA')).toBe('american');
    expect(normalizeCuisine('us')).toBe('american');

    expect(normalizeCuisine('British')).toBe('british');
    expect(normalizeCuisine('UK')).toBe('british');
    expect(normalizeCuisine('United Kingdom')).toBe('british');
    expect(normalizeCuisine('English')).toBe('british');

    expect(normalizeCuisine('Chinese')).toBe('chinese');
    expect(normalizeCuisine('China')).toBe('chinese');

    expect(normalizeCuisine('French')).toBe('french');
    expect(normalizeCuisine('France')).toBe('french');

    expect(normalizeCuisine('Indian')).toBe('indian');
    expect(normalizeCuisine('India')).toBe('indian');

    expect(normalizeCuisine('Italian')).toBe('italian');
    expect(normalizeCuisine('Italy')).toBe('italian');

    expect(normalizeCuisine('Spanish')).toBe('spanish');
    expect(normalizeCuisine('Spain')).toBe('spanish');

    expect(normalizeCuisine('Thai')).toBe('thai');
    expect(normalizeCuisine('Thailand')).toBe('thai');

    expect(normalizeCuisine('Mexican')).toBe('mexican');
    expect(normalizeCuisine('Mexico')).toBe('mexican');
  });

  it('handles surrounding whitespace and mixed case', () => {
    expect(normalizeCuisine('   iTaLiAn   ')).toBe('italian');
    expect(normalizeCuisine('  UNITED  STATES  ')).toBe('american');
  });

  it('maps blanks, reserved words, and non-strings to null', () => {
    expect(normalizeCuisine(null)).toBeNull();
    expect(normalizeCuisine(undefined)).toBeNull();
    expect(normalizeCuisine('')).toBeNull();
    expect(normalizeCuisine('    ')).toBeNull();
    expect(normalizeCuisine('any')).toBeNull();
    expect(normalizeCuisine('Any')).toBeNull();
    expect(normalizeCuisine('none')).toBeNull();
    expect(normalizeCuisine('null')).toBeNull();
    expect(normalizeCuisine('unknown')).toBeNull();
    expect(normalizeCuisine(123)).toBeNull();
    expect(normalizeCuisine({})).toBeNull();
  });

  it('preserves unmapped valid cuisines as trimmed lowercase slugs', () => {
    expect(normalizeCuisine('Lebanese')).toBe('lebanese');
    expect(normalizeCuisine('Mediterranean')).toBe('mediterranean');
  });
});

describe('CANDIDATES', () => {
  it('contains canonical values and display labels for expected cuisines', () => {
    const expected = [
      { value: 'italian', label: 'Italian' },
      { value: 'chinese', label: 'Chinese' },
      { value: 'thai', label: 'Thai' },
      { value: 'indian', label: 'Indian' },
      { value: 'british', label: 'British' },
      { value: 'french', label: 'French' },
      { value: 'spanish', label: 'Spanish' },
      { value: 'american', label: 'American' },
    ];
    expect(CANDIDATES).toEqual(expected);
  });

  it('uses canonical slugs instead of raw source country aliases', () => {
    const values = CANDIDATES.map((c) => c.value);
    expect(values).not.toContain('united states');
    expect(values).not.toContain('india');
    expect(values).not.toContain('france');
  });
});

describe('CUISINE_OPTIONS', () => {
  it('yields at least four non-Any cuisines backed by the production catalog', () => {
    expect(CUISINE_OPTIONS.length).toBeGreaterThanOrEqual(4);
    const labels = CUISINE_OPTIONS.map((c) => c.label);
    expect(labels).toContain('Italian');
    expect(labels).toContain('American');
    expect(labels).toContain('British');
    expect(labels).toContain('Indian');
    expect(labels).not.toContain('Chinese');
  });

  it('contains no dead options: every visible cuisine has at least one candidate recipe', () => {
    for (const option of CUISINE_OPTIONS) {
      const matching = BUNDLED_CATALOG.filter((recipe) => recipe.cuisine === option.value);
      expect(matching.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('never fabricates an unbacked mapping', () => {
    // French, Spanish, Thai are candidates but have no matching recipes in the current catalog
    const unbacked = CANDIDATES.filter(
      (candidate) => !BUNDLED_CATALOG.some((recipe) => recipe.cuisine === candidate.value)
    );
    for (const missing of unbacked) {
      expect(CUISINE_OPTIONS.some((opt) => opt.value === missing.value)).toBe(false);
    }
  });
});

describe('cuisine preference and engine relaxation ladder', () => {
  const pantry = new Set([
    'bread',
    'peanut_butter',
    'jam',
    'cheddar_cheese',
    'butter',
    'spaghetti',
    'tomato',
    'garlic',
    'olive_oil',
    'salt',
    'porridge_oats',
    'milk',
    'honey',
    'lentils',
    'water',
    'vegetable_stock',
    'cumin',
    'rice',
    'stir_fry_vegetables',
    'soy_sauce',
    'sesame_seed_oil',
  ]);

  it('returns exact cuisine matches in strict mode when candidates exist', () => {
    const prefs = toEnginePreferences(
      {
        equipment: ['microwave', 'stove'],
        allergens: [],
        dietary: [],
        dislikedRecipes: [],
        skippedRecipes: [],
      },
      'italian'
    );

    const result = decide(BUNDLED_CATALOG, pantry, prefs, 30);
    const totalResults = Object.values(result.buckets).flat();
    expect(totalResults.length).toBeGreaterThan(0);
    expect(totalResults.every((s) => s.recipe.cuisine === 'italian')).toBe(true);
  });

  it('relaxes cuisine when needed without relaxing hard constraints', () => {
    // Requesting a cuisine with no 5-minute stove recipe
    const prefs = toEnginePreferences(
      {
        equipment: ['microwave'],
        allergens: ['dairy'],
        dietary: [],
        dislikedRecipes: [],
        skippedRecipes: [],
      },
      'italian'
    );

    // Microwave pizza has mozzarella (dairy), so no italian recipe is dairy-safe
    const result = decideWithRelaxation(BUNDLED_CATALOG, pantry, prefs, 15);
    const allSuggestions = Object.values(result.buckets).flat();
    // Recommendations returned via relaxation
    expect(allSuggestions.length).toBeGreaterThan(0);
    // Hard constraint (dairy allergen) was NEVER relaxed
    for (const suggestion of allSuggestions) {
      const allergens = suggestion.recipe.ingredients.flatMap((i) => i.allergenGroups);
      expect(allergens).not.toContain('dairy');
    }
    // Stated relaxation includes dropped cuisine
    expect(result.appliedRelaxations.some((r) => r.kind === 'cuisine_dropped')).toBe(true);
  });
});
