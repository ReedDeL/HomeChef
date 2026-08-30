import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { STAPLE_INGREDIENT_IDS, lookupIngredient } from '@/data/catalog';
import type { BodyGoal, WeeklyMealPlan } from '@/contracts/meal-journeys';
import type { DietaryTag, Equipment, IngredientId, UserPreferences } from '@/engine/types';
import { clearLocalMealSatiety } from '@/lib/meal-satiety';
import type { MealPrepReminderLeadMinutes } from '@/lib/meal-prep-reminder';
import { getJSON, setJSON, storage } from '@/lib/storage';

/**
 * Client state: the constraints the user declared and the pantry they own.
 *
 * This is deliberately local-first rather than Supabase-backed. The decision
 * engine is synchronous and the bundled catalog ships inside the app, so the
 * entire product works with no account and no network — which is what lets the
 * first result appear in under ten seconds instead of behind a signup form.
 * `src/lib/queries/` already implements the server-backed data access; wiring
 * it in is a swap at this seam, not a rewrite, and is blocked only on auth
 * being enabled for the project.
 *
 * Server state, when it arrives, belongs in TanStack Query — never here.
 */

export interface EquipmentTier {
  id: string;
  label: string;
  subtitle: string;
  equipment: readonly Equipment[];
}

/** Shared language for appliance choices across onboarding and Settings. */
export const APPLIANCE_SECTION_TITLE = 'Kitchen appliances';
export const APPLIANCE_SECTION_DESCRIPTION =
  'Add appliances you use to expand the meals HomeChef can recommend.';

/** Spec §3: three tiers, single-select, subtitle does the explaining. */
export const EQUIPMENT_TIERS: readonly EquipmentTier[] = [
  {
    id: 'microwave',
    label: 'Microwave only',
    subtitle: 'Cook using only a microwave',
    equipment: ['microwave'],
  },
  {
    id: 'kettle',
    label: 'Microwave + kettle',
    subtitle: 'Microwave plus electric kettle or boiling water',
    equipment: ['microwave', 'kettle'],
  },
  {
    id: 'full',
    label: 'Full kitchen',
    subtitle: 'Stove, oven, and standard cookware',
    equipment: ['microwave', 'stove', 'oven', 'kettle'],
  },
];

/** Spec §3: multi-select appliances, added on top of the tier. */
export const EXTRA_APPLIANCES: readonly { id: Equipment; label: string }[] = [
  { id: 'air_fryer', label: 'Air fryer' },
  { id: 'rice_cooker', label: 'Rice cooker' },
  { id: 'blender', label: 'Blender' },
  { id: 'toaster_oven', label: 'Toaster oven' },
];

/**
 * Common allergens, keyed to the allergen *groups* the ingredient vocabulary
 * actually attaches (`butter` -> `dairy`) rather than to ingredient ids.
 *
 * `hasAllergen` matches a declared id against both an ingredient's id and its
 * groups, so declaring the group is what catches every member of it. One UI
 * option can map to several groups where the vocabulary splits them — "Nuts"
 * has to name both `nut` and `tree_nut`, or selecting it would miss half the
 * ingredients it is supposed to exclude.
 *
 * Every group listed here exists in src/data/ingredients.json. Offering an
 * allergen the vocabulary cannot detect would be worse than omitting it: the
 * user would believe they were protected. Sesame is absent for exactly that
 * reason.
 */
export const COMMON_ALLERGENS: readonly { id: string; label: string; groups: IngredientId[] }[] = [
  { id: 'peanut', label: 'Peanuts', groups: ['peanut'] },
  { id: 'tree_nut', label: 'Tree nuts', groups: ['nut', 'tree_nut'] },
  { id: 'dairy', label: 'Dairy', groups: ['dairy'] },
  { id: 'egg', label: 'Egg', groups: ['egg'] },
  { id: 'gluten', label: 'Gluten', groups: ['gluten', 'wheat'] },
  { id: 'soy', label: 'Soy', groups: ['soy'] },
  { id: 'shellfish', label: 'Shellfish', groups: ['shellfish'] },
  { id: 'fish', label: 'Fish', groups: ['fish'] },
];

/**
 * The everyday ingredients offered for one-tap adding, beyond the staples the
 * app already assumes. Kept deliberately short: this is a fast correction
 * surface, not a catalog browser. Anything not here arrives via the photo
 * pipeline or search once those land.
 *
 * Filtered against the vocabulary at module load so a renamed id becomes an
 * absent chip rather than a chip that silently matches no recipe.
 */
export const COMMON_PANTRY_IDS: readonly IngredientId[] = [
  'egg',
  'milk',
  'butter',
  'cheese',
  'chicken',
  'beef',
  'rice',
  'pasta',
  'bread',
  'potato',
  'onion',
  'garlic',
  'tomato',
  'carrot',
  'lemon',
  'yogurt',
].filter((id) => lookupIngredient(id) !== undefined);

export const DIETARY_PRESETS: readonly { id: DietaryTag; label: string }[] = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten_free', label: 'Gluten free' },
  { id: 'dairy_free', label: 'Dairy free' },
  { id: 'halal', label: 'Halal' },
  { id: 'kosher', label: 'Kosher' },
  { id: 'pescatarian', label: 'Pescatarian' },
];

export type ThemeMode = 'system' | 'light' | 'dark';

export interface BodyMetrics {
  heightCentimeters: number | null;
  weightKilograms: number | null;
}

const DISLIKED_KEY = 'homechef-disliked';
const SKIPPED_KEY = 'homechef-skipped';

interface KitchenState {
  tierId: string;
  extras: Equipment[];
  /** COMMON_ALLERGENS option ids, expanded to vocabulary groups on read. */
  allergens: string[];
  dietary: DietaryTag[];
  pantry: IngredientId[];
  onboardingDone: boolean;
  themeMode: ThemeMode;
  mealPrepRemindersEnabled: boolean;
  mealPrepReminderLeadMinutes: MealPrepReminderLeadMinutes;
  mealPrepReminderOnboardingComplete: boolean;
  dislikedRecipes: string[];
  skippedRecipes: string[];
  /** Optional local-only goal and metrics. Never sent to analytics. */
  bodyGoal: BodyGoal | null;
  bodyMetrics: BodyMetrics;
  weeklyPlan: WeeklyMealPlan | null;
  checkedPlanGroceryNeeds: string[];

  setTier: (tierId: string) => void;
  toggleExtra: (equipment: Equipment) => void;
  toggleAllergen: (id: string) => void;
  toggleDietary: (tag: DietaryTag) => void;
  togglePantryItem: (id: IngredientId) => void;
  removePantryItem: (id: IngredientId) => void;
  /** Bulk add from a confirmed photo scan. Idempotent — adding twice is a no-op. */
  addPantryItems: (ids: readonly IngredientId[]) => void;
  completeOnboarding: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setMealPrepRemindersEnabled: (enabled: boolean) => void;
  setMealPrepReminderLeadMinutes: (minutes: MealPrepReminderLeadMinutes) => void;
  setMealPrepReminderOnboardingComplete: (complete: boolean) => void;
  recordDislike: (recipeId: string) => void;
  removeDislike: (recipeId: string) => void;
  resetDislikes: () => void;
  recordSkip: (recipeId: string) => void;
  setBodyGoal: (goal: BodyGoal | null) => void;
  setBodyMetrics: (metrics: Partial<BodyMetrics>) => void;
  clearBodyData: () => void;
  setWeeklyPlan: (plan: WeeklyMealPlan | null) => void;
  togglePlanGroceryNeed: (ingredientId: string) => void;
  clearPlanGroceryChecks: () => void;
  reset: () => void;
}

const DEFAULT_TIER_ID = 'full';

/**
 * Zustand's persist middleware expects the async web Storage shape. The
 * underlying store is synchronous on both platforms, so these resolve
 * immediately — the promise is a formality of the interface.
 */
const zustandStorage = createJSONStorage(() => ({
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.remove(key),
}));

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set) => ({
      tierId: DEFAULT_TIER_ID,
      extras: [],
      allergens: [],
      dietary: [],
      // Spec §10: "We assumed you have these. Tap any you don't."
      pantry: [...STAPLE_INGREDIENT_IDS],
      onboardingDone: false,
      themeMode: 'system',
      mealPrepRemindersEnabled: false,
      mealPrepReminderLeadMinutes: 0,
      mealPrepReminderOnboardingComplete: false,
      dislikedRecipes: getJSON<string[]>(DISLIKED_KEY) ?? [],
      skippedRecipes: getJSON<string[]>(SKIPPED_KEY) ?? [],
      bodyGoal: null,
      bodyMetrics: { heightCentimeters: null, weightKilograms: null },
      weeklyPlan: null,
      checkedPlanGroceryNeeds: [],

      setTier: (tierId) => set({ tierId }),
      toggleExtra: (equipment) => set((s) => ({ extras: toggle(s.extras, equipment) })),
      toggleAllergen: (id) => set((s) => ({ allergens: toggle(s.allergens, id) })),
      toggleDietary: (tag) => set((s) => ({ dietary: toggle(s.dietary, tag) })),
      togglePantryItem: (id) => set((s) => ({ pantry: toggle(s.pantry, id) })),
      removePantryItem: (id) => set((s) => ({ pantry: s.pantry.filter((item) => item !== id) })),
      // Mirrors the `unique (household_id, ingredient_id)` constraint the
      // Postgres pantry enforces: a second carton of milk is the same row, not
      // a new one.
      addPantryItems: (ids) => set((s) => ({ pantry: [...new Set([...s.pantry, ...ids])] })),
      completeOnboarding: () => set({ onboardingDone: true }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setMealPrepRemindersEnabled: (mealPrepRemindersEnabled) => set({ mealPrepRemindersEnabled }),
      setMealPrepReminderLeadMinutes: (mealPrepReminderLeadMinutes) =>
        set({ mealPrepReminderLeadMinutes }),
      setMealPrepReminderOnboardingComplete: (mealPrepReminderOnboardingComplete) =>
        set({ mealPrepReminderOnboardingComplete }),
      recordDislike: (recipeId) =>
        set((s) => {
          const updated = [...new Set([...s.dislikedRecipes, recipeId])];
          setJSON(DISLIKED_KEY, updated);
          return { dislikedRecipes: updated };
        }),
      removeDislike: (recipeId) =>
        set((s) => {
          const updated = s.dislikedRecipes.filter((item) => item !== recipeId);
          setJSON(DISLIKED_KEY, updated);
          return { dislikedRecipes: updated };
        }),
      resetDislikes: () =>
        set(() => {
          setJSON(DISLIKED_KEY, []);
          return { dislikedRecipes: [] };
        }),
      recordSkip: (recipeId) =>
        set((s) => {
          const updated = [...new Set([...s.skippedRecipes, recipeId])];
          setJSON(SKIPPED_KEY, updated);
          return { skippedRecipes: updated };
        }),
      setBodyGoal: (bodyGoal) => set({ bodyGoal }),
      setBodyMetrics: (metrics) =>
        set((state) => ({
          bodyMetrics: {
            heightCentimeters:
              metrics.heightCentimeters === undefined
                ? state.bodyMetrics.heightCentimeters
                : metrics.heightCentimeters,
            weightKilograms:
              metrics.weightKilograms === undefined
                ? state.bodyMetrics.weightKilograms
                : metrics.weightKilograms,
          },
        })),
      clearBodyData: () =>
        set({ bodyGoal: null, bodyMetrics: { heightCentimeters: null, weightKilograms: null } }),
      setWeeklyPlan: (weeklyPlan) => set({ weeklyPlan, checkedPlanGroceryNeeds: [] }),
      togglePlanGroceryNeed: (ingredientId) =>
        set((state) => ({
          checkedPlanGroceryNeeds: state.checkedPlanGroceryNeeds.includes(ingredientId)
            ? state.checkedPlanGroceryNeeds.filter((id) => id !== ingredientId)
            : [...state.checkedPlanGroceryNeeds, ingredientId],
        })),
      clearPlanGroceryChecks: () => set({ checkedPlanGroceryNeeds: [] }),
      reset: () => {
        setJSON(DISLIKED_KEY, []);
        setJSON(SKIPPED_KEY, []);
        clearLocalMealSatiety();
        set({
          tierId: DEFAULT_TIER_ID,
          extras: [],
          allergens: [],
          dietary: [],
          pantry: [...STAPLE_INGREDIENT_IDS],
          onboardingDone: false,
          themeMode: 'system',
          mealPrepRemindersEnabled: false,
          mealPrepReminderLeadMinutes: 0,
          mealPrepReminderOnboardingComplete: false,
          dislikedRecipes: [],
          skippedRecipes: [],
          bodyGoal: null,
          bodyMetrics: { heightCentimeters: null, weightKilograms: null },
          weeklyPlan: null,
          checkedPlanGroceryNeeds: [],
        });
      },
    }),
    { name: 'homechef-kitchen', storage: zustandStorage }
  )
);

/**
 * Projects the stored constraints into the engine's input type.
 *
 * The engine takes plain data and knows nothing about Zustand, storage, or
 * Supabase — this function is the whole of that boundary on the client side,
 * mirroring what `src/lib/adapters/from-database.ts` does for Postgres rows.
 */
export function toEnginePreferences(
  state: Pick<KitchenState, 'tierId' | 'extras' | 'allergens' | 'dietary'> & {
    dislikedRecipes?: readonly string[];
    skippedRecipes?: readonly string[];
    bodyGoal?: BodyGoal | null;
  },
  preferredCuisine: string | null = null
): UserPreferences {
  const tier = EQUIPMENT_TIERS.find((candidate) => candidate.id === state.tierId);
  const base = tier?.equipment ?? [];

  // The store holds UI option ids; the engine wants the vocabulary's allergen
  // groups. Expanding here keeps the widening in one place — a screen that
  // passed the raw selection through would silently under-filter.
  const allergenGroups = state.allergens.flatMap(
    (id) => COMMON_ALLERGENS.find((allergen) => allergen.id === id)?.groups ?? []
  );

  const disliked = state.dislikedRecipes
    ? new Set(state.dislikedRecipes)
    : new Set(getJSON<string[]>(DISLIKED_KEY) ?? []);
  const skipped = state.skippedRecipes
    ? new Set(state.skippedRecipes)
    : new Set(getJSON<string[]>(SKIPPED_KEY) ?? []);

  return {
    equipment: [...new Set([...base, ...state.extras])],
    allergens: [...new Set(allergenGroups)],
    dietary: state.dietary,
    dislikedRecipeIds: disliked,
    skippedRecipeIds: skipped,
    preferredCuisine,
    bodyGoal: state.bodyGoal,
  };
}

/**
 * `skipped` is a weak negative signal and `disliked` a strong one; the engine
 * de-ranks one and eliminates the other, so they are stored separately even
 * though the UI records them from adjacent gestures.
 */
export function recordSkip(recipeId: string): void {
  useKitchenStore.getState().recordSkip(recipeId);
}

export function recordDislike(recipeId: string): void {
  useKitchenStore.getState().recordDislike(recipeId);
}

export function removeDislike(recipeId: string): void {
  useKitchenStore.getState().removeDislike(recipeId);
}

export function resetDislikes(): void {
  useKitchenStore.getState().resetDislikes();
}
