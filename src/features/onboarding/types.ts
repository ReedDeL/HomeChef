import type { DietaryTag, Equipment } from '@/data/types';

export type WeightGoal = 'lose' | 'maintain' | 'gain' | null;

export interface OnboardingProfile {
  equipment: Equipment[];
  allergies: string[];
  dietaryPreferences: DietaryTag[];
  weightGoal: WeightGoal;
  hasCompletedOnboarding: boolean;
}

export const DEFAULT_PROFILE: OnboardingProfile = {
  equipment: [],
  allergies: [],
  dietaryPreferences: [],
  weightGoal: null,
  hasCompletedOnboarding: false,
};

export const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'microwave', label: 'Microwave' },
  { value: 'kettle', label: 'Kettle' },
  { value: 'hot-plate', label: 'Hot plate' },
  { value: 'stove', label: 'Stove' },
  { value: 'oven', label: 'Oven' },
  { value: 'air-fryer', label: 'Air fryer' },
  { value: 'rice-cooker', label: 'Rice cooker' },
  { value: 'blender', label: 'Blender' },
  { value: 'toaster-oven', label: 'Toaster oven' },
];

export const DIETARY_OPTIONS: { value: DietaryTag; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten-free', label: 'Gluten-free' },
  { value: 'dairy-free', label: 'Dairy-free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Keto' },
];
