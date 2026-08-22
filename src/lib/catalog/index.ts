import { z } from 'zod';

import { isRecipeHardConstraintSatisfied } from '@/engine/filter-hard';
import { DIETARY_TAGS, EQUIPMENT } from '@/engine/types';
import type { DietaryTag, Equipment, Recipe, UserPreferences } from '@/engine/types';
import { getSupabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase-generated';

export const CATALOG_RPC_LIMIT = 100;
const DEFAULT_CATALOG_RPC_LIMIT = 20;

export interface CatalogCandidateRequest {
  pantryIngredientIds: readonly string[];
  ownedEquipment: readonly Equipment[];
  allergens: readonly string[];
  dietaryRestrictions: readonly DietaryTag[];
  requestedMinutes?: number | null;
  cuisine?: string | null;
  excludedRecipeIds?: readonly string[];
  limit: number;
}

export interface NormalizedCatalogCandidateRequest {
  pantryIngredientIds: string[];
  ownedEquipment: Equipment[];
  allergens: string[];
  dietaryRestrictions: DietaryTag[];
  requestedMinutes: number | null;
  cuisine: string | null;
  excludedRecipeIds: string[];
  limit: number;
}

export interface CatalogAttribution {
  sourceId: string;
  sourceVersion: string;
  attribution: string;
  url: string | null;
}

interface CatalogRpcResult {
  data: unknown;
  error: { message: string } | null;
}

type CandidateRpcArgs = Database['public']['Functions']['catalog_candidates']['Args'];
type DetailRpcArgs = Database['public']['Functions']['catalog_recipe_detail']['Args'];

type CatalogRpcInvocation =
  | { name: 'catalog_candidates'; args: CandidateRpcArgs }
  | { name: 'catalog_recipe_detail'; args: DetailRpcArgs }
  | { name: 'catalog_attributions' };

export type CatalogRpc = (invocation: CatalogRpcInvocation) => Promise<CatalogRpcResult>;

export class CatalogContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogContractError';
  }
}

const nonBlankString = z.string().trim().min(1);
const verifiedSafetyStatus = z.literal('verified');
const equipmentSchema = z.enum(EQUIPMENT);
const dietaryTagSchema = z.enum(DIETARY_TAGS);
const ingredientSchema = z
  .object({
    id: nonBlankString,
    quantity: z.number().finite().positive().nullable(),
    unit: z.string().trim().min(1).nullable(),
    rawMeasure: nonBlankString,
    allergenGroups: z.array(nonBlankString),
    allergenStatus: verifiedSafetyStatus,
  })
  .strict();

const candidateObjectSchema = z
  .object({
    recipe_id: nonBlankString,
    title: nonBlankString,
    image_url: z.string().url().nullable(),
    cuisine: nonBlankString.nullable(),
    total_time_minutes: z.number().int().positive(),
    equipment_required: z.array(equipmentSchema).min(1),
    equipment_status: verifiedSafetyStatus,
    allergen_status: verifiedSafetyStatus,
    dietary_status: verifiedSafetyStatus,
    dietary_tags: z.array(dietaryTagSchema),
    ingredients: z.array(ingredientSchema).min(1),
    pantry_match_count: z.number().int().nonnegative(),
  })
  .strict();

function enforceEquipmentSafety(
  row: { equipment_required: Equipment[] },
  context: z.RefinementCtx
): void {
  if (row.equipment_required.includes('unclassified')) {
    context.addIssue({ code: 'custom', message: 'Unclassified equipment is unsafe.' });
  }
  if (row.equipment_required.includes('none') && row.equipment_required.length !== 1) {
    context.addIssue({ code: 'custom', message: 'No-equipment must be exclusive.' });
  }
}

const candidateSchema = candidateObjectSchema.superRefine(enforceEquipmentSafety);

const detailSchema = candidateObjectSchema
  .omit({ pantry_match_count: true })
  .extend({
    instructions: nonBlankString,
    provenance: z
      .array(
        z
          .object({
            sourceId: nonBlankString,
            sourceVersion: nonBlankString,
            sourceRecipeId: nonBlankString,
            archiveSha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict()
      )
      .min(1),
  })
  .strict()
  .superRefine(enforceEquipmentSafety);

const attributionSchema = z
  .object({
    source_id: nonBlankString,
    source_version: nonBlankString,
    archive_url: z.string().url().refine(isHttpsUrl),
    archive_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    license_name: nonBlankString,
    license_url: z.string().url().refine(isHttpsUrl),
    attribution: nonBlankString,
  })
  .strict();

export function normalizeCandidateRequest(
  request: CatalogCandidateRequest
): NormalizedCatalogCandidateRequest {
  return {
    pantryIngredientIds: normalizedStrings(request.pantryIngredientIds),
    ownedEquipment: normalizedAllowed(request.ownedEquipment, EQUIPMENT),
    allergens: normalizedStrings(request.allergens),
    dietaryRestrictions: normalizedAllowed(request.dietaryRestrictions, DIETARY_TAGS),
    requestedMinutes:
      typeof request.requestedMinutes === 'number' && Number.isInteger(request.requestedMinutes)
        ? Math.max(1, request.requestedMinutes)
        : null,
    cuisine: normalizedOptionalString(request.cuisine),
    excludedRecipeIds: normalizedStrings(request.excludedRecipeIds ?? []),
    limit: normalizeLimit(request.limit),
  };
}

export async function fetchCatalogCandidates(
  request: CatalogCandidateRequest,
  rpc: CatalogRpc = invokeCatalogRpc
): Promise<Recipe[]> {
  const normalized = normalizeCandidateRequest(request);
  const result = await rpc({
    name: 'catalog_candidates',
    args: {
      p_pantry_ingredient_ids: normalized.pantryIngredientIds,
      p_owned_equipment: normalized.ownedEquipment,
      p_allergens: normalized.allergens,
      p_dietary_restrictions: normalized.dietaryRestrictions,
      p_requested_minutes: normalized.requestedMinutes ?? undefined,
      p_cuisine: normalized.cuisine ?? undefined,
      p_excluded_recipe_ids: normalized.excludedRecipeIds,
      p_limit: normalized.limit,
    },
  });

  throwRpcError(result);
  const rows = parsePayload(
    z.array(candidateSchema).max(CATALOG_RPC_LIMIT),
    result.data,
    'candidates'
  );
  return rows.map(toCandidateRecipe);
}

export async function fetchCatalogRecipeDetail(
  recipeId: string,
  rpc: CatalogRpc = invokeCatalogRpc
): Promise<Recipe | null> {
  if (recipeId.trim().length === 0) return null;
  const result = await rpc({ name: 'catalog_recipe_detail', args: { p_recipe_id: recipeId } });
  throwRpcError(result);
  const rows = parsePayload(z.array(detailSchema).max(1), result.data, 'recipe detail');
  return rows[0] ? toDetailRecipe(rows[0]) : null;
}

export async function fetchCatalogAttributions(
  rpc: CatalogRpc = invokeCatalogRpc
): Promise<CatalogAttribution[]> {
  const result = await rpc({ name: 'catalog_attributions' });
  throwRpcError(result);
  const rows = parsePayload(z.array(attributionSchema), result.data, 'attributions');
  return rows.map((row) => ({
    sourceId: row.source_id,
    sourceVersion: row.source_version,
    attribution: row.attribution,
    url: row.license_url,
  }));
}

/**
 * Hosted metadata takes precedence for an offline duplicate. Hosted-only
 * duplicates retain their first validated occurrence so their order is stable.
 */
export function mergeCatalogCandidates(
  offline: readonly Recipe[],
  hosted: readonly Recipe[]
): Recipe[] {
  const offlineById = new Map<string, Recipe>();
  for (const recipe of offline) {
    if (!offlineById.has(recipe.id)) offlineById.set(recipe.id, recipe);
  }
  const hostedById = new Map<string, Recipe>();
  for (const recipe of hosted) {
    if (!hostedById.has(recipe.id)) hostedById.set(recipe.id, recipe);
  }
  const merged = [...offlineById.values()].map((recipe) => hostedById.get(recipe.id) ?? recipe);
  const offlineIds = new Set(offlineById.keys());
  const hostedOnlyIds = new Set<string>();
  for (const recipe of hosted) {
    if (!offlineIds.has(recipe.id) && !hostedOnlyIds.has(recipe.id)) {
      hostedOnlyIds.add(recipe.id);
      merged.push(recipe);
    }
  }
  return merged;
}

/** Query cache keeps only individually validated candidate/detail values. */
export class CatalogRecipeCache {
  private readonly candidates = new Map<string, Recipe>();
  private readonly details = new Map<string, Recipe>();

  setCandidates(recipes: readonly Recipe[]): void {
    for (const recipe of recipes) this.setCandidate(recipe);
  }

  setCandidate(recipe: Recipe): void {
    this.candidates.set(recipe.id, recipe);
  }

  setDetail(recipe: Recipe): void {
    this.details.set(recipe.id, recipe);
    this.candidates.delete(recipe.id);
  }

  getDetail(id: string): Recipe | null {
    return this.details.get(id) ?? null;
  }

  getCandidate(id: string): Recipe | null {
    return this.candidates.get(id) ?? null;
  }
}

export const catalogRecipeCache = new CatalogRecipeCache();

/**
 * Writes a validated detail before TanStack Query receives it, so a cache-first
 * route selector observes the current successful response on that render.
 */
export async function fetchAndCacheCatalogRecipeDetail(
  recipeId: string,
  cache: CatalogRecipeCache,
  fetchDetail: (id: string) => Promise<Recipe | null> = fetchCatalogRecipeDetail
): Promise<Recipe | null> {
  const detail = await fetchDetail(recipeId);
  if (detail) cache.setDetail(detail);
  return detail;
}

/** A candidate has no preparation text, so it is never a complete detail. */
export function isRecipeDetailComplete(recipe: Recipe | null): recipe is Recipe {
  return Boolean(recipe && recipe.instructions.trim().length > 0 && recipe.ingredients.length > 0);
}

/**
 * Complete details are selected in this order: validated cached detail,
 * current hosted response, then the offline detail. Every option is checked
 * against the user's current hard constraints before it can render or cook.
 */
export function selectCatalogRecipeDetail({
  hostedDetail = null,
  cachedDetail = null,
  offlineDetail = null,
  preferences,
}: {
  hostedDetail?: Recipe | null;
  cachedDetail?: Recipe | null;
  offlineDetail?: Recipe | null;
  preferences: UserPreferences;
}): Recipe | null {
  const candidates = [cachedDetail, hostedDetail, offlineDetail];
  return (
    candidates.find(
      (recipe) =>
        isRecipeDetailComplete(recipe) && isRecipeHardConstraintSatisfied(recipe, preferences)
    ) ?? null
  );
}

/** Candidates are safe previews only; they can never enable cook mode. */
export function selectCatalogCandidatePreview(
  candidate: Recipe | null,
  preferences: UserPreferences
): Recipe | null {
  return candidate && isRecipeHardConstraintSatisfied(candidate, preferences) ? candidate : null;
}

export function mergeAttributions(
  hosted: readonly CatalogAttribution[],
  transitional: readonly CatalogAttribution[]
): CatalogAttribution[] {
  const seen = new Set<string>();
  const merged: CatalogAttribution[] = [];
  for (const attribution of [...hosted, ...transitional]) {
    const key = `${attribution.sourceId}\u0000${attribution.sourceVersion}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...attribution, url: isHttpsUrl(attribution.url) ? attribution.url : null });
  }
  return merged;
}

export function isHttpsUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

async function invokeCatalogRpc(invocation: CatalogRpcInvocation): Promise<CatalogRpcResult> {
  const client = getSupabase();
  const response =
    invocation.name === 'catalog_candidates'
      ? await client.rpc('catalog_candidates', invocation.args)
      : invocation.name === 'catalog_recipe_detail'
        ? await client.rpc('catalog_recipe_detail', invocation.args)
        : await client.rpc('catalog_attributions');
  const { data, error } = response;
  return { data, error: error ? { message: error.message } : null };
}

function throwRpcError(result: CatalogRpcResult): void {
  if (result.error) throw new Error(result.error.message);
}

function parsePayload<Output>(schema: z.ZodType<Output>, payload: unknown, label: string): Output {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new CatalogContractError(`Invalid catalog ${label} response.`);
  return parsed.data;
}

function toCandidateRecipe(row: z.infer<typeof candidateSchema>): Recipe {
  return {
    id: row.recipe_id,
    title: row.title,
    imageUrl: row.image_url,
    cuisine: row.cuisine,
    totalTimeMinutes: row.total_time_minutes,
    equipmentRequired: row.equipment_required,
    dietaryTags: row.dietary_tags,
    ingredients: row.ingredients.map((ingredient) => ({
      id: ingredient.id,
      measure: ingredient.rawMeasure,
      allergenGroups: ingredient.allergenGroups,
    })),
    // Candidate RPC intentionally omits preparation text. A detail RPC fills it
    // before cook mode, while the engine only needs constraint metadata.
    instructions: '',
  };
}

function toDetailRecipe(row: z.infer<typeof detailSchema>): Recipe {
  return {
    ...toCandidateRecipe({ ...row, pantry_match_count: 0 }),
    instructions: row.instructions,
  };
}

function normalizedStrings(values: readonly string[]): string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ].sort();
}

function normalizedAllowed<T extends string>(values: readonly T[], allowed: readonly T[]): T[] {
  const allowedSet = new Set<string>(allowed);
  return normalizedStrings(values).filter((value): value is T => allowedSet.has(value));
}

function normalizedOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CATALOG_RPC_LIMIT;
  return Math.min(CATALOG_RPC_LIMIT, Math.max(1, Math.trunc(value)));
}
