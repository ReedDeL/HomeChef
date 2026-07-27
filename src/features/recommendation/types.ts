import type { DietaryTag, Equipment } from '@/data/types';

export interface CandidateRecipe {
  id: string;
  name: string;
  cookTimeMinutes: number | null;
  requiredEquipment: Equipment[];
  dietaryTags: DietaryTag[];
  imageUrl: string | null;
  /** Lowercased ingredient names. */
  ingredients: string[];
}

export interface ScoredRecipe extends CandidateRecipe {
  matchedIngredientCount: number;
  totalIngredientCount: number;
  matchPercent: number;
  missingIngredients: string[];
}

export type RecommendationBucket = 'allIngredients' | 'most' | 'some' | 'requiresGroceryList';

export type RecommendationResult = Record<RecommendationBucket, ScoredRecipe[]>;

export interface RecommendationFilters {
  pantryIngredientNames: Set<string>;
  ownedEquipment: Set<Equipment>;
  allergies: string[];
  dietaryPreferences: DietaryTag[];
  dislikedRecipeIds: Set<string>;
  /** Set when the user taps "I don't have enough time" — re-ranks toward the fastest options. */
  maxTimeMinutes?: number | null;
  /** Results per bucket. Three good answers beat four hundred. */
  bucketCap?: number;
}
