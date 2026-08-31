import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { ingredient, makePrefs, makeRecipe } from '@/engine/__fixtures__';
import { decideWithRelaxation, TIME_TIERS } from '@/engine/relax';
import {
  buildHostedCatalogCandidateRequest,
  CatalogContractError,
  CatalogRecipeCache,
  fetchAndCacheCatalogRecipeDetail,
  fetchCatalogAttributions,
  fetchCatalogCandidates,
  fetchCatalogRecipeDetail,
  isRecipeDetailComplete,
  mergeCatalogCandidates,
  mergeAttributions,
  normalizeCandidateRequest,
  selectCatalogRecipeDetail,
  type CatalogRpc,
} from '@/lib/catalog';
import { queryKeys } from '@/lib/queries/keys';

const validCandidate = {
  recipe_id: 'hc-hosted-1',
  title: 'Hosted eggs',
  image_url: null,
  cuisine: 'american',
  total_time_minutes: 15,
  equipment_required: ['microwave'],
  equipment_status: 'verified',
  allergen_status: 'verified',
  dietary_status: 'verified',
  dietary_tags: ['vegetarian'],
  ingredients: [
    {
      id: 'egg',
      quantity: 2,
      unit: null,
      rawMeasure: '2 eggs',
      allergenGroups: ['egg'],
      allergenStatus: 'verified',
    },
  ],
  pantry_match_count: 1,
};

function rpcReturning(data: unknown): CatalogRpc {
  return async () => ({ data, error: null });
}

describe('normalizeCandidateRequest', () => {
  it('sorts, deduplicates, and bounds RPC arguments without Set identity', () => {
    expect(
      normalizeCandidateRequest({
        pantryIngredientIds: ['egg', 'butter', 'egg'],
        ownedEquipment: ['stove', 'microwave', 'stove'],
        allergens: ['dairy', 'egg', 'dairy'],
        dietaryRestrictions: ['vegan', 'vegetarian', 'vegan'],
        requestedMinutes: 30,
        cuisine: ' thai ',
        excludedRecipeIds: ['b', 'a', 'b'],
        limit: 1000,
      })
    ).toEqual({
      pantryIngredientIds: ['butter', 'egg'],
      ownedEquipment: ['microwave', 'stove'],
      allergens: ['dairy', 'egg'],
      dietaryRestrictions: ['vegan', 'vegetarian'],
      requestedMinutes: 30,
      cuisine: 'thai',
      excludedRecipeIds: ['a', 'b'],
      limit: 100,
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'defaults a non-finite limit (%s) to the safe RPC default',
    (limit) => {
      expect(
        normalizeCandidateRequest({
          pantryIngredientIds: [],
          ownedEquipment: [],
          allergens: [],
          dietaryRestrictions: [],
          limit,
        }).limit
      ).toBe(20);
    }
  );
});

describe('hosted recovery candidates', () => {
  it('covers soft recovery while the engine still enforces hard constraints', () => {
    const preferences = makePrefs({
      equipment: ['microwave'],
      allergens: ['nut'],
      dietary: ['vegan'],
      dislikedRecipeIds: new Set(['disliked']),
      preferredCuisine: 'thai',
    });
    const request = buildHostedCatalogCandidateRequest({
      pantryIngredientIds: ['rice', 'salt'],
      preferences,
    });
    const hosted = [
      makeRecipe({
        id: 'recovered',
        cuisine: 'italian',
        totalTimeMinutes: 60,
        equipmentRequired: ['microwave'],
        dietaryTags: ['vegan'],
        ingredients: [ingredient('rice'), ingredient('salt')],
      }),
      makeRecipe({
        id: 'wrong-equipment',
        cuisine: 'italian',
        totalTimeMinutes: 60,
        equipmentRequired: ['oven'],
        dietaryTags: ['vegan'],
        ingredients: [ingredient('rice')],
      }),
      makeRecipe({
        id: 'allergen',
        cuisine: 'italian',
        totalTimeMinutes: 60,
        equipmentRequired: ['microwave'],
        dietaryTags: ['vegan'],
        ingredients: [ingredient('peanut', ['nut'])],
      }),
      makeRecipe({
        id: 'wrong-dietary',
        cuisine: 'italian',
        totalTimeMinutes: 60,
        equipmentRequired: ['microwave'],
        dietaryTags: [],
        ingredients: [ingredient('rice')],
      }),
      makeRecipe({
        id: 'disliked',
        cuisine: 'italian',
        totalTimeMinutes: 60,
        equipmentRequired: ['microwave'],
        dietaryTags: ['vegan'],
        ingredients: [ingredient('rice')],
      }),
    ];

    expect(request).toMatchObject({
      pantryIngredientIds: ['rice', 'salt'],
      ownedEquipment: ['microwave'],
      allergens: ['nut'],
      dietaryRestrictions: ['vegan'],
      excludedRecipeIds: ['disliked'],
      requestedMinutes: Math.max(...TIME_TIERS),
      cuisine: null,
      limit: 100,
    });

    const result = decideWithRelaxation(hosted, new Set(['rice', 'salt']), preferences, 15);
    const resultIds = Object.values(result.buckets)
      .flat()
      .map((scored) => scored.recipe.id);

    expect(resultIds).toContain('recovered');
    for (const invalidRecipeId of ['wrong-equipment', 'allergen', 'wrong-dietary', 'disliked']) {
      expect(resultIds).not.toContain(invalidRecipeId);
    }
    expect(result.appliedRelaxations).toEqual(
      expect.arrayContaining([
        { kind: 'time_widened', from: 15, to: 60 },
        { kind: 'cuisine_dropped', cuisine: 'thai' },
      ])
    );
  });
});

describe('catalog candidate query keys', () => {
  it('keeps comma-containing ingredient arrays structurally distinct', () => {
    const base = {
      ownedEquipment: [],
      allergens: [],
      dietaryRestrictions: [],
      requestedMinutes: 30,
      cuisine: null,
      excludedRecipeIds: [],
      limit: 20,
    };

    expect(
      queryKeys.catalogCandidates({ ...base, pantryIngredientIds: ['egg,butter'] })
    ).not.toEqual(queryKeys.catalogCandidates({ ...base, pantryIngredientIds: ['egg', 'butter'] }));
  });

  it('keeps a recipe id named idle distinct from the idle detail key', () => {
    expect(queryKeys.catalogRecipeDetail('idle')).not.toEqual(queryKeys.catalogRecipeDetailIdle());
  });
});

describe('hosted catalog contracts', () => {
  it('rejects a hosted candidate with unknown safety status', async () => {
    await expect(
      fetchCatalogCandidates(
        {
          pantryIngredientIds: [],
          ownedEquipment: ['microwave'],
          allergens: [],
          dietaryRestrictions: [],
          limit: 20,
        },
        rpcReturning([{ ...validCandidate, equipment_status: 'unknown' }])
      )
    ).rejects.toBeInstanceOf(CatalogContractError);
  });

  it('rejects an empty ingredient list instead of treating it as safe', async () => {
    await expect(
      fetchCatalogCandidates(
        {
          pantryIngredientIds: [],
          ownedEquipment: ['microwave'],
          allergens: [],
          dietaryRestrictions: [],
          limit: 20,
        },
        rpcReturning([{ ...validCandidate, ingredients: [] }])
      )
    ).rejects.toBeInstanceOf(CatalogContractError);
  });

  it('retains ingredient order and raw measures from a valid RPC result', async () => {
    const recipes = await fetchCatalogCandidates(
      {
        pantryIngredientIds: [],
        ownedEquipment: ['microwave'],
        allergens: [],
        dietaryRestrictions: [],
        limit: 20,
      },
      rpcReturning([validCandidate])
    );

    expect(recipes[0]?.ingredients).toEqual([
      { id: 'egg', measure: '2 eggs', allergenGroups: ['egg'] },
    ]);
  });

  it('throws a typed error when the RPC reports an error', async () => {
    const rpc: CatalogRpc = async () => ({ data: null, error: { message: 'offline' } });
    await expect(
      fetchCatalogCandidates(
        {
          pantryIngredientIds: [],
          ownedEquipment: ['microwave'],
          allergens: [],
          dietaryRestrictions: [],
          limit: 20,
        },
        rpc
      )
    ).rejects.toThrow('offline');
  });

  it('rejects detail rows without instructions', async () => {
    await expect(
      fetchCatalogRecipeDetail('hc-hosted-1', rpcReturning([{ ...validCandidate }]))
    ).rejects.toBeInstanceOf(CatalogContractError);
  });
});

describe('candidate merging and detail resolution', () => {
  it('prefers an active hosted duplicate while preserving offline order', () => {
    const offline = [
      makeRecipe({ id: 'offline-first' }),
      makeRecipe({ id: 'shared', title: 'Old title' }),
    ];
    const hosted = [
      makeRecipe({ id: 'shared', title: 'New title' }),
      makeRecipe({ id: 'hosted-last' }),
    ];

    expect(
      mergeCatalogCandidates(offline, hosted).map((recipe) => [recipe.id, recipe.title])
    ).toEqual([
      ['offline-first', 'Test Recipe'],
      ['shared', 'New title'],
      ['hosted-last', 'Test Recipe'],
    ]);
  });

  it('keeps the first hosted-only duplicate deterministically', () => {
    const merged = mergeCatalogCandidates(
      [],
      [makeRecipe({ id: 'hosted', title: 'First' }), makeRecipe({ id: 'hosted', title: 'Later' })]
    );

    expect(merged.map((recipe) => [recipe.id, recipe.title])).toEqual([['hosted', 'First']]);
  });

  it('keeps the first offline duplicate and does not duplicate cards', () => {
    const merged = mergeCatalogCandidates(
      [
        makeRecipe({ id: 'offline', title: 'First offline' }),
        makeRecipe({ id: 'offline', title: 'Later offline' }),
      ],
      []
    );

    expect(merged.map((recipe) => [recipe.id, recipe.title])).toEqual([
      ['offline', 'First offline'],
    ]);
  });

  it('does not let a cached candidate suppress a hosted detail', () => {
    const cache = new CatalogRecipeCache();
    cache.setCandidate(makeRecipe({ id: 'cached', instructions: '' }));
    const hosted = makeRecipe({ id: 'cached', title: 'Hosted', instructions: 'Cook.' });

    const recipe = selectCatalogRecipeDetail({
      hostedDetail: hosted,
      cachedDetail: cache.getDetail('cached'),
      preferences: makePrefs(),
    });

    expect(cache.getDetail('cached')).toBeNull();
    expect(isRecipeDetailComplete(cache.getCandidate('cached'))).toBe(false);
    expect(recipe).toEqual(hosted);
  });

  it('prefers a complete cached detail over a newer hosted response', () => {
    const cached = makeRecipe({ id: 'shared', title: 'Cached', instructions: 'Cook cached.' });
    const hosted = makeRecipe({ id: 'shared', title: 'Hosted', instructions: 'Cook hosted.' });

    expect(
      selectCatalogRecipeDetail({
        cachedDetail: cached,
        hostedDetail: hosted,
        preferences: makePrefs(),
      })
    ).toEqual(cached);
  });

  it('stores a successful detail fetch before returning it to the query', async () => {
    const cache = new CatalogRecipeCache();
    const detail = makeRecipe({ id: 'fresh', title: 'Fresh detail', instructions: 'Cook.' });

    await expect(
      fetchAndCacheCatalogRecipeDetail('fresh', cache, async () => detail)
    ).resolves.toEqual(detail);
    expect(cache.getDetail('fresh')).toEqual(detail);
  });

  it('does not let a cached candidate mask a complete offline detail', () => {
    const cache = new CatalogRecipeCache();
    cache.setCandidate(makeRecipe({ id: 'shared', instructions: '' }));
    const offline = makeRecipe({ id: 'shared', title: 'Offline detail', instructions: 'Cook.' });

    const recipe = selectCatalogRecipeDetail({
      cachedDetail: cache.getDetail('shared'),
      offlineDetail: offline,
      preferences: makePrefs(),
    });

    expect(recipe).toEqual(offline);
  });

  it('retains an offline detail when no hosted detail is available', () => {
    const offline = makeRecipe({ id: 'offline' });
    const recipe = selectCatalogRecipeDetail({
      offlineDetail: offline,
      preferences: makePrefs(),
    });

    expect(recipe).toEqual(offline);
  });

  it('uses a safe offline detail when cached detail no longer matches equipment', () => {
    const cache = new CatalogRecipeCache();
    cache.setDetail(
      makeRecipe({ id: 'shared', equipmentRequired: ['oven'], instructions: 'Bake.' })
    );
    const offline = makeRecipe({ id: 'shared', title: 'Offline', instructions: 'Cook.' });

    expect(
      selectCatalogRecipeDetail({
        cachedDetail: cache.getDetail('shared'),
        offlineDetail: offline,
        preferences: makePrefs({ equipment: ['microwave'] }),
      })
    ).toEqual(offline);
  });

  it('rejects cached and direct details after the user adds an allergen', () => {
    const cache = new CatalogRecipeCache();
    cache.setDetail(
      makeRecipe({
        id: 'cached',
        ingredients: [ingredient('peanut', ['nut'])],
        instructions: 'Cook.',
      })
    );
    expect(
      selectCatalogRecipeDetail({
        hostedDetail: makeRecipe({
          id: 'cached',
          ingredients: [ingredient('peanut', ['nut'])],
          instructions: 'Cook.',
        }),
        cachedDetail: cache.getDetail('cached'),
        preferences: makePrefs({ allergens: ['nut'] }),
      })
    ).toBeNull();
  });

  it('rejects a direct hosted detail after an allergen or dietary preference changes', () => {
    const hosted = makeRecipe({
      ingredients: [ingredient('peanut', ['nut'])],
      dietaryTags: ['vegan'],
      instructions: 'Cook.',
    });

    expect(
      selectCatalogRecipeDetail({
        hostedDetail: hosted,
        preferences: makePrefs({ allergens: ['nut'] }),
      })
    ).toBeNull();
    expect(
      selectCatalogRecipeDetail({
        hostedDetail: hosted,
        preferences: makePrefs({ dietary: ['vegetarian'] }),
      })
    ).toBeNull();
  });
});

describe('attribution', () => {
  const transitional = {
    sourceId: 'wikibooks-cookbook',
    sourceVersion: '2026-08-27',
    attribution: 'Recipe text adapted from Wikibooks Cookbook under CC BY-SA 4.0',
    url: 'https://en.wikibooks.org/wiki/Cookbook:Recipes',
  };

  it('keeps transitional attribution when the hosted RPC fails', async () => {
    const rpc: CatalogRpc = async () => ({ data: null, error: { message: 'offline' } });
    await expect(fetchCatalogAttributions(rpc)).rejects.toThrow('offline');
    expect(mergeAttributions([], [transitional])).toEqual([transitional]);
  });

  it('removes duplicate rows and invalid link targets', () => {
    expect(
      mergeAttributions(
        [
          {
            sourceId: 'source-a',
            sourceVersion: '1',
            attribution: 'Approved source',
            url: 'http://not-secure.example',
          },
          {
            sourceId: 'source-a',
            sourceVersion: '1',
            attribution: 'Approved source',
            url: 'https://approved.example/licenses',
          },
        ],
        [transitional]
      )
    ).toEqual([
      { sourceId: 'source-a', sourceVersion: '1', attribution: 'Approved source', url: null },
      transitional,
    ]);
  });
});
