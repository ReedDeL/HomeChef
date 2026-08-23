import { useQuery } from '@tanstack/react-query';

import {
  catalogRecipeCache,
  fetchAndCacheCatalogRecipeDetail,
  fetchCatalogAttributions,
  fetchCatalogCandidates,
  normalizeCandidateRequest,
  type CatalogCandidateRequest,
} from '@/lib/catalog';
import { queryKeys } from '@/lib/queries/keys';

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
}

export function useCatalogCandidates(request: CatalogCandidateRequest | null) {
  const normalized = request ? normalizeCandidateRequest(request) : null;

  return useQuery({
    queryKey: normalized
      ? queryKeys.catalogCandidates(normalized)
      : queryKeys.catalogCandidatesIdle(),
    queryFn: () => {
      if (!normalized) return Promise.resolve([]);
      return fetchCatalogCandidates(normalized);
    },
    enabled: normalized !== null && hasSupabaseConfig(),
    retry: 1,
  });
}

export function useCatalogRecipeDetail(recipeId: string | undefined) {
  return useQuery({
    queryKey: recipeId
      ? queryKeys.catalogRecipeDetail(recipeId)
      : queryKeys.catalogRecipeDetailIdle(),
    queryFn: () =>
      recipeId
        ? fetchAndCacheCatalogRecipeDetail(recipeId, catalogRecipeCache)
        : Promise.resolve(null),
    enabled: Boolean(recipeId) && hasSupabaseConfig(),
    retry: 1,
  });
}

export function useCatalogAttributions() {
  return useQuery({
    queryKey: queryKeys.catalogAttributions(),
    queryFn: () => fetchCatalogAttributions(),
    enabled: hasSupabaseConfig(),
    retry: 1,
  });
}
