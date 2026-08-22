export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      catalog_ingredients: {
        Row: {
          allergen_groups: string[]
          allergen_status: string
          created_at: string
          display_name: string
          ingredient_id: string
          is_staple: boolean
          release_id: string
        }
        Insert: {
          allergen_groups?: string[]
          allergen_status: string
          created_at?: string
          display_name: string
          ingredient_id: string
          is_staple?: boolean
          release_id: string
        }
        Update: {
          allergen_groups?: string[]
          allergen_status?: string
          created_at?: string
          display_name?: string
          ingredient_id?: string
          is_staple?: boolean
          release_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_ingredients_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "catalog_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_recipe_ingredients: {
        Row: {
          ingredient_id: string
          position: number
          quantity: number | null
          raw_measure: string
          recipe_id: string
          release_id: string
          unit: string | null
        }
        Insert: {
          ingredient_id: string
          position: number
          quantity?: number | null
          raw_measure: string
          recipe_id: string
          release_id: string
          unit?: string | null
        }
        Update: {
          ingredient_id?: string
          position?: number
          quantity?: number | null
          raw_measure?: string
          recipe_id?: string
          release_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_recipe_ingredients_release_id_ingredient_id_fkey"
            columns: ["release_id", "ingredient_id"]
            isOneToOne: false
            referencedRelation: "catalog_ingredients"
            referencedColumns: ["release_id", "ingredient_id"]
          },
          {
            foreignKeyName: "catalog_recipe_ingredients_release_id_recipe_id_fkey"
            columns: ["release_id", "recipe_id"]
            isOneToOne: false
            referencedRelation: "catalog_recipes"
            referencedColumns: ["release_id", "recipe_id"]
          },
        ]
      }
      catalog_recipe_sources: {
        Row: {
          archive_sha256: string
          recipe_id: string
          release_id: string
          source_id: string
          source_recipe_id: string
          source_version: string
        }
        Insert: {
          archive_sha256: string
          recipe_id: string
          release_id: string
          source_id: string
          source_recipe_id: string
          source_version: string
        }
        Update: {
          archive_sha256?: string
          recipe_id?: string
          release_id?: string
          source_id?: string
          source_recipe_id?: string
          source_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_recipe_sources_release_id_recipe_id_fkey"
            columns: ["release_id", "recipe_id"]
            isOneToOne: false
            referencedRelation: "catalog_recipes"
            referencedColumns: ["release_id", "recipe_id"]
          },
          {
            foreignKeyName: "catalog_recipe_sources_release_id_source_id_source_version_archive_sha256_fkey"
            columns: ["release_id", "source_id", "source_version", "archive_sha256"]
            isOneToOne: false
            referencedRelation: "catalog_release_sources"
            referencedColumns: ["release_id", "source_id", "source_version", "archive_sha256"]
          },
        ]
      }
      catalog_recipes: {
        Row: {
          allergen_status: string
          created_at: string
          cuisine: string | null
          dietary_status: string
          dietary_tags: string[]
          equipment_required: string[]
          equipment_status: string
          image_url: string | null
          instructions: string
          is_offline: boolean
          recipe_id: string
          release_id: string
          title: string
          total_time_minutes: number
        }
        Insert: {
          allergen_status: string
          created_at?: string
          cuisine?: string | null
          dietary_status: string
          dietary_tags?: string[]
          equipment_required: string[]
          equipment_status: string
          image_url?: string | null
          instructions: string
          is_offline?: boolean
          recipe_id: string
          release_id: string
          title: string
          total_time_minutes: number
        }
        Update: {
          allergen_status?: string
          created_at?: string
          cuisine?: string | null
          dietary_status?: string
          dietary_tags?: string[]
          equipment_required?: string[]
          equipment_status?: string
          image_url?: string | null
          instructions?: string
          is_offline?: boolean
          recipe_id?: string
          release_id?: string
          title?: string
          total_time_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_recipes_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "catalog_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_release_sources: {
        Row: {
          archive_sha256: string
          archive_url: string
          attribution: string
          created_at: string
          license_name: string
          license_url: string
          release_id: string
          rights_status: string
          source_id: string
          source_version: string
        }
        Insert: {
          archive_sha256: string
          archive_url: string
          attribution: string
          created_at?: string
          license_name: string
          license_url: string
          release_id: string
          rights_status: string
          source_id: string
          source_version: string
        }
        Update: {
          archive_sha256?: string
          archive_url?: string
          attribution?: string
          created_at?: string
          license_name?: string
          license_url?: string
          release_id?: string
          rights_status?: string
          source_id?: string
          source_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_release_sources_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "catalog_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_releases: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          ingredient_count: number
          is_active: boolean
          offline_ready: boolean
          offline_recipe_count: number
          recipe_count: number
          retired_at: string | null
          source_count: number
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id: string
          ingredient_count?: number
          is_active?: boolean
          offline_ready?: boolean
          offline_recipe_count?: number
          recipe_count?: number
          retired_at?: string | null
          source_count?: number
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          ingredient_count?: number
          is_active?: boolean
          offline_ready?: boolean
          offline_recipe_count?: number
          recipe_count?: number
          retired_at?: string | null
          source_count?: number
        }
        Relationships: []
      }
      household_members: {
        Row: {
          household_id: string
          user_id: string
        }
        Insert: {
          household_id: string
          user_id: string
        }
        Update: {
          household_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          added_by: string | null
          household_id: string
          id: string
          ingredient_id: string
          purchased_on: string | null
          quantity: number | null
          source: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          household_id: string
          id?: string
          ingredient_id: string
          purchased_on?: string | null
          quantity?: number | null
          source?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          household_id?: string
          id?: string
          ingredient_id?: string
          purchased_on?: string | null
          quantity?: number | null
          source?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_feedback: {
        Row: {
          created_at: string
          made_on: string | null
          recipe_id: string
          user_id: string
          verdict: string
        }
        Insert: {
          created_at?: string
          made_on?: string | null
          recipe_id: string
          user_id: string
          verdict: string
        }
        Update: {
          created_at?: string
          made_on?: string | null
          recipe_id?: string
          user_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          household_id: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          household_id: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          household_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          allergens: string[]
          dietary: string[]
          equipment: string[]
          onboarding_done: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          allergens?: string[]
          dietary?: string[]
          equipment?: string[]
          onboarding_done?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          allergens?: string[]
          dietary?: string[]
          equipment?: string[]
          onboarding_done?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      catalog_attributions: {
        Args: Record<PropertyKey, never>
        Returns: {
          archive_sha256: string
          archive_url: string
          attribution: string
          license_name: string
          license_url: string
          source_id: string
          source_version: string
        }[]
      }
      catalog_candidates: {
        Args: {
          p_allergens?: string[]
          p_cuisine?: string
          p_dietary_restrictions?: string[]
          p_excluded_recipe_ids?: string[]
          p_limit?: number
          p_owned_equipment?: string[]
          p_pantry_ingredient_ids?: string[]
          p_requested_minutes?: number
        }
        Returns: {
          allergen_status: string
          cuisine: string | null
          dietary_status: string
          dietary_tags: string[]
          equipment_required: string[]
          equipment_status: string
          image_url: string | null
          ingredients: Json
          pantry_match_count: number
          recipe_id: string
          title: string
          total_time_minutes: number
        }[]
      }
      catalog_recipe_detail: {
        Args: {
          p_recipe_id: string
        }
        Returns: {
          allergen_status: string
          cuisine: string | null
          dietary_status: string
          dietary_tags: string[]
          equipment_required: string[]
          equipment_status: string
          image_url: string | null
          ingredients: Json
          instructions: string
          provenance: Json
          recipe_id: string
          title: string
          total_time_minutes: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
