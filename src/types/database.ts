/**
 * Row shapes for the tables in supabase/migrations/.
 *
 * These are derived from `supabase-generated.ts`, which is normally emitted by
 *
 *     npx supabase gen types typescript --linked > src/types/supabase-generated.ts
 *
 * against an authorized target. Remote generation is intentionally outside
 * this task's authority, so the protected-catalog section is a local,
 * generated-style mirror of 0005_protected_catalog.sql. Regenerate it before
 * an authorized deployment. A column added, dropped, or retyped in a migration
 * becomes a compile error here on regeneration rather than a hand-written
 * interface that quietly lies about what Postgres will return.
 *
 * This file restores the narrow TypeScript domains that CHECK-constrained
 * columns and JSON RPC payloads cannot express in generated types alone.
 */
import type { Database, Tables } from '@/types/supabase-generated';

/**
 * Narrows a generated `text` column to the union its CHECK constraint permits.
 *
 * `Union extends Row[K]` is the guard: if the column stops being assignable
 * from that union -- someone swaps the CHECK for a real Postgres enum, say --
 * this stops compiling, which is the signal to delete the hand-written union
 * and use the generated `Enums<...>` instead of maintaining it twice.
 */
type NarrowColumn<Row, K extends keyof Row, Union extends Row[K]> = Omit<Row, K> & Record<K, Union>;

export type HouseholdRow = Tables<'households'>;

export type ProfileRow = Tables<'profiles'>;

export type UserPreferencesRow = Tables<'user_preferences'>;

/** `meal_feedback.verdict`, per the CHECK in 0001_initial_schema.sql. */
export type FeedbackVerdict = 'liked' | 'disliked' | 'skipped';

export type MealFeedbackRow = NarrowColumn<Tables<'meal_feedback'>, 'verdict', FeedbackVerdict>;

/** `inventory.source`, per the CHECK in 0001_initial_schema.sql. */
export type InventorySource = 'manual' | 'photo' | 'staple' | 'shopping_list';

export type InventoryRow = NarrowColumn<Tables<'inventory'>, 'source', InventorySource>;

/** Catalog safety checks deliberately retain an explicit unknown outcome. */
export type CatalogSafetyStatus = 'verified' | 'unknown';

/** Closed equipment vocabulary for the protected catalog. */
export type CatalogEquipment =
  | 'microwave'
  | 'stove'
  | 'oven'
  | 'air_fryer'
  | 'kettle'
  | 'blender'
  | 'rice_cooker'
  | 'toaster_oven'
  | 'none'
  | 'unclassified';

/** Closed dietary vocabulary for the protected catalog. */
export type CatalogDietaryTag =
  | 'vegetarian'
  | 'vegan'
  | 'gluten_free'
  | 'dairy_free'
  | 'halal'
  | 'kosher'
  | 'pescatarian'
  | 'keto';

/** `catalog_release_sources.rights_status`, per 0005_protected_catalog.sql. */
export type CatalogRightsStatus = 'approved' | 'quarantine';

export type CatalogReleaseRow = Tables<'catalog_releases'>;

export type CatalogReleaseSourceRow = NarrowColumn<
  Tables<'catalog_release_sources'>,
  'rights_status',
  CatalogRightsStatus
>;

export type CatalogIngredientRow = NarrowColumn<
  Tables<'catalog_ingredients'>,
  'allergen_status',
  CatalogSafetyStatus
>;

export type CatalogRecipeRow = Omit<
  Tables<'catalog_recipes'>,
  'allergen_status' | 'dietary_status' | 'dietary_tags' | 'equipment_required' | 'equipment_status'
> & {
  allergen_status: CatalogSafetyStatus;
  dietary_status: CatalogSafetyStatus;
  dietary_tags: CatalogDietaryTag[];
  equipment_required: CatalogEquipment[];
  equipment_status: CatalogSafetyStatus;
};

export type CatalogRecipeIngredientRow = Tables<'catalog_recipe_ingredients'>;

export type CatalogRecipeSourceRow = Tables<'catalog_recipe_sources'>;

export interface CatalogIngredientPayload {
  allergenGroups: string[];
  allergenStatus: CatalogSafetyStatus;
  id: string;
  quantity: number | null;
  rawMeasure: string;
  unit: string | null;
}

export interface CatalogProvenancePayload {
  archiveSha256: string;
  sourceId: string;
  sourceRecipeId: string;
  sourceVersion: string;
}

export type CatalogCandidateRpcRow = Omit<
  Database['public']['Functions']['catalog_candidates']['Returns'][number],
  | 'allergen_status'
  | 'dietary_status'
  | 'dietary_tags'
  | 'equipment_required'
  | 'equipment_status'
  | 'ingredients'
> & {
  allergen_status: CatalogSafetyStatus;
  dietary_status: CatalogSafetyStatus;
  dietary_tags: CatalogDietaryTag[];
  equipment_required: CatalogEquipment[];
  equipment_status: CatalogSafetyStatus;
  ingredients: CatalogIngredientPayload[];
};

export type CatalogRecipeDetailRpcRow = Omit<
  Database['public']['Functions']['catalog_recipe_detail']['Returns'][number],
  | 'allergen_status'
  | 'dietary_status'
  | 'dietary_tags'
  | 'equipment_required'
  | 'equipment_status'
  | 'ingredients'
  | 'provenance'
> & {
  allergen_status: CatalogSafetyStatus;
  dietary_status: CatalogSafetyStatus;
  dietary_tags: CatalogDietaryTag[];
  equipment_required: CatalogEquipment[];
  equipment_status: CatalogSafetyStatus;
  ingredients: CatalogIngredientPayload[];
  provenance: CatalogProvenancePayload[];
};

export type CatalogAttributionRpcRow =
  Database['public']['Functions']['catalog_attributions']['Returns'][number];
