/**
 * Temporary typed overlay for the dual-meal-journeys migration.
 *
 * Docker is unavailable in the current WSL environment, so the required
 * `supabase gen types typescript --local` command cannot run. This composes the
 * untouched generated schema with only the migration's new objects; delete
 * this file and point callers back to `supabase-generated.ts` immediately
 * after a local reset and regeneration prove the generated shapes match.
 */
import type { Database as GeneratedDatabase, Json } from '@/types/supabase-generated';

type Relationship<
  Name extends string,
  Columns extends string[],
  ReferencedRelation extends string,
  ReferencedColumns extends string[],
  IsOneToOne extends boolean = false,
> = {
  foreignKeyName: Name;
  columns: Columns;
  isOneToOne: IsOneToOne;
  referencedRelation: ReferencedRelation;
  referencedColumns: ReferencedColumns;
};

type JourneyTables = {
  body_profiles: {
    Row: {
      activity_level: string;
      age_years: number;
      breastfeeding: boolean;
      calculation_sex: string;
      goal: string;
      height_centimeters: number;
      pregnant: boolean;
      user_id: string;
      weight_kilograms: number;
    };
    Insert: {
      activity_level: string;
      age_years: number;
      breastfeeding: boolean;
      calculation_sex: string;
      goal: string;
      height_centimeters: number;
      pregnant: boolean;
      user_id: string;
      weight_kilograms: number;
    };
    Update: {
      activity_level?: string;
      age_years?: number;
      breastfeeding?: boolean;
      calculation_sex?: string;
      goal?: string;
      height_centimeters?: number;
      pregnant?: boolean;
      user_id?: string;
      weight_kilograms?: number;
    };
    Relationships: [
      Relationship<'body_profiles_user_id_fkey', ['user_id'], 'profiles', ['id'], true>,
    ];
  };
  taste_signals: {
    Row: {
      id: string;
      journey: string;
      kind: string;
      recipe_id: string;
      recorded_at: string;
      user_id: string;
    };
    Insert: {
      id?: string;
      journey: string;
      kind: string;
      recipe_id: string;
      recorded_at: string;
      user_id: string;
    };
    Update: {
      id?: string;
      journey?: string;
      kind?: string;
      recipe_id?: string;
      recorded_at?: string;
      user_id?: string;
    };
    Relationships: [Relationship<'taste_signals_user_id_fkey', ['user_id'], 'profiles', ['id']>];
  };
  meal_satiety: {
    Row: {
      id: string;
      level: string;
      recipe_id: string;
      recorded_at: string;
      user_id: string;
    };
    Insert: {
      id?: string;
      level: string;
      recipe_id: string;
      recorded_at?: string;
      user_id?: string;
    };
    Update: {
      id?: string;
      level?: string;
      recipe_id?: string;
      recorded_at?: string;
      user_id?: string;
    };
    Relationships: [Relationship<'meal_satiety_user_id_fkey', ['user_id'], 'profiles', ['id']>];
  };
  onboarding_progress: {
    Row: {
      body_profile_completed: boolean;
      photo_taste_completed: boolean;
      reminder_completed: boolean;
      safety_completed: boolean;
      updated_at: string;
      user_id: string;
      week_preference_completed: boolean;
    };
    Insert: {
      body_profile_completed?: boolean;
      photo_taste_completed?: boolean;
      reminder_completed?: boolean;
      safety_completed?: boolean;
      updated_at?: string;
      user_id: string;
      week_preference_completed?: boolean;
    };
    Update: {
      body_profile_completed?: boolean;
      photo_taste_completed?: boolean;
      reminder_completed?: boolean;
      safety_completed?: boolean;
      updated_at?: string;
      user_id?: string;
      week_preference_completed?: boolean;
    };
    Relationships: [
      Relationship<'onboarding_progress_user_id_fkey', ['user_id'], 'profiles', ['id'], true>,
    ];
  };
  weekly_meal_plans: {
    Row: {
      created_at: string;
      id: string;
      stated_relaxations: string[];
      status: string;
      updated_at: string;
      user_id: string;
      week_start: string;
    };
    Insert: {
      created_at?: string;
      id?: string;
      stated_relaxations?: string[];
      status: string;
      updated_at?: string;
      user_id: string;
      week_start: string;
    };
    Update: {
      created_at?: string;
      id?: string;
      stated_relaxations?: string[];
      status?: string;
      updated_at?: string;
      user_id?: string;
      week_start?: string;
    };
    Relationships: [
      Relationship<'weekly_meal_plans_user_id_fkey', ['user_id'], 'profiles', ['id']>,
    ];
  };
  weekly_meal_plan_entries: {
    Row: {
      entry_date: string;
      id: string;
      kind: string;
      plan_id: string;
      planned_meal_time: string | null;
      portion_disclaimer: string | null;
      portion_label: string | null;
      portion_servings: number | null;
      reason: string | null;
      recipe_id: string | null;
      stated_relaxations: string[];
      user_id: string;
    };
    Insert: {
      entry_date: string;
      id?: string;
      kind: string;
      plan_id: string;
      planned_meal_time?: string | null;
      portion_disclaimer?: string | null;
      portion_label?: string | null;
      portion_servings?: number | null;
      reason?: string | null;
      recipe_id?: string | null;
      stated_relaxations?: string[];
      user_id: string;
    };
    Update: {
      entry_date?: string;
      id?: string;
      kind?: string;
      plan_id?: string;
      planned_meal_time?: string | null;
      portion_disclaimer?: string | null;
      portion_label?: string | null;
      portion_servings?: number | null;
      reason?: string | null;
      recipe_id?: string | null;
      stated_relaxations?: string[];
      user_id?: string;
    };
    Relationships: [
      Relationship<
        'weekly_meal_plan_entries_plan_owner_fkey',
        ['plan_id', 'user_id'],
        'weekly_meal_plans',
        ['id', 'user_id']
      >,
    ];
  };
  plan_linked_grocery_needs: {
    Row: {
      dates: string[];
      id: string;
      ingredient_id: string;
      plan_id: string;
      recipe_ids: string[];
      user_id: string;
    };
    Insert: {
      dates: string[];
      id?: string;
      ingredient_id: string;
      plan_id: string;
      recipe_ids: string[];
      user_id: string;
    };
    Update: {
      dates?: string[];
      id?: string;
      ingredient_id?: string;
      plan_id?: string;
      recipe_ids?: string[];
      user_id?: string;
    };
    Relationships: [
      Relationship<
        'plan_linked_grocery_needs_plan_owner_fkey',
        ['plan_id', 'user_id'],
        'weekly_meal_plans',
        ['id', 'user_id']
      >,
    ];
  };
  meal_reminder_preferences: {
    Row: {
      enabled: boolean;
      lead_minutes: number;
      updated_at: string;
      user_id: string;
    };
    Insert: {
      enabled: boolean;
      lead_minutes: number;
      updated_at?: string;
      user_id: string;
    };
    Update: {
      enabled?: boolean;
      lead_minutes?: number;
      updated_at?: string;
      user_id?: string;
    };
    Relationships: [
      Relationship<'meal_reminder_preferences_user_id_fkey', ['user_id'], 'profiles', ['id'], true>,
    ];
  };
};

type GeneratedPublic = GeneratedDatabase['public'];

export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedPublic, 'Tables' | 'Functions'> & {
    Tables: GeneratedPublic['Tables'] & JourneyTables;
    Functions: GeneratedPublic['Functions'] & {
      create_weekly_meal_plan: {
        Args: {
          p_entries: Json;
          p_grocery_needs: Json;
          p_stated_relaxations: string[];
          p_status: string;
          p_week_start: string;
        };
        Returns: string;
      };
      replace_weekly_plan_children: {
        Args: {
          p_entries: Json;
          p_grocery_needs: Json;
          p_plan_id: string;
        };
        Returns: undefined;
      };
    };
  };
};

export type Tables<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row'];
