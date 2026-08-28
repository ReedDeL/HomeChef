import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SettingsAction } from '@/components/ui/SettingsAction';
import { Screen } from '@/components/ui/Screen';
import { SelectableCard } from '@/components/ui/SelectableCard';
import { Text } from '@/components/ui/Text';
import { BUNDLED_CATALOG, lookupIngredient } from '@/data/catalog';
import { weeklyMealPlanSchema, type WeeklyMealPlan } from '@/contracts/meal-journeys';
import {
  derivePlanLinkedGroceryNeeds,
  getPlanGroceryNeedMealNames,
  recomputePlanGroceryNeeds,
} from '@/engine/plan-grocery-needs';
import { hasAllergen, isEquipmentSatisfied, satisfiesDietary } from '@/engine/filter-hard';
import { planWeek } from '@/engine/plan-week';
import { applyPlanPreferences } from '@/engine/plan-preferences';
import type { DailyPlanPreference, Recipe } from '@/engine/types';
import { syncMealPrepReminders } from '@/lib/meal-prep-notifications';
import { useKitchenStore, toEnginePreferences } from '@/store/kitchen';
import { radius, space } from '@/theme/tokens';

type Step = 'days' | 'style' | 'variety' | 'proposal' | 'grocery';
type Days = 3 | 5 | 7;
type PrepStyle = 'quick' | 'batch' | 'balanced';
type Variety = 'variety' | 'repeats';

const DAYS_OPTIONS = [
  { value: 3 as Days, title: '3 days', subtitle: 'A short reset' },
  { value: 5 as Days, title: '5 days', subtitle: 'Most of the work week' },
  { value: 7 as Days, title: '7 days', subtitle: 'The full week' },
] as const;
const STYLE_OPTIONS = [
  { value: 'quick' as PrepStyle, title: 'Mostly quick', subtitle: 'Keep weeknight cooking light' },
  { value: 'batch' as PrepStyle, title: 'Batch prep', subtitle: 'Make a little more up front' },
  {
    value: 'balanced' as PrepStyle,
    title: 'A balanced mix',
    subtitle: 'Some quick meals, some prep ahead',
  },
] as const;
const VARIETY_OPTIONS = [
  { value: 'variety' as Variety, title: 'More variety', subtitle: 'Try a different meal each day' },
  {
    value: 'repeats' as Variety,
    title: 'Comfortable repeats',
    subtitle: 'Reuse favorites and ingredients',
  },
] as const;

export default function PlanScreen() {
  const router = useRouter();
  const tierId = useKitchenStore((state) => state.tierId);
  const extras = useKitchenStore((state) => state.extras);
  const allergens = useKitchenStore((state) => state.allergens);
  const dietary = useKitchenStore((state) => state.dietary);
  const pantry = useKitchenStore((state) => state.pantry);
  const dislikedRecipes = useKitchenStore((state) => state.dislikedRecipes);
  const bodyGoal = useKitchenStore((state) => state.bodyGoal);
  const weeklyPlan = useKitchenStore((state) => state.weeklyPlan);
  const checkedNeeds = useKitchenStore((state) => state.checkedPlanGroceryNeeds);
  const setWeeklyPlan = useKitchenStore((state) => state.setWeeklyPlan);
  const toggleNeed = useKitchenStore((state) => state.togglePlanGroceryNeed);
  const addPantryItems = useKitchenStore((state) => state.addPantryItems);
  const clearPlanGroceryChecks = useKitchenStore((state) => state.clearPlanGroceryChecks);
  const remindersEnabled = useKitchenStore((state) => state.mealPrepRemindersEnabled);
  const leadMinutes = useKitchenStore((state) => state.mealPrepReminderLeadMinutes);

  const [step, setStep] = useState<Step>(weeklyPlan?.status === 'confirmed' ? 'grocery' : 'days');
  const [days, setDays] = useState<Days>(7);
  const [prepStyle, setPrepStyle] = useState<PrepStyle>('balanced');
  const [variety, setVariety] = useState<Variety>('variety');
  const [proposal, setProposal] = useState<WeeklyMealPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const preferences = useMemo(
    () =>
      toEnginePreferences({ tierId, extras, allergens, dietary, dislikedRecipes, bodyGoal }, null),
    [tierId, extras, allergens, dietary, dislikedRecipes, bodyGoal]
  );
  const pantrySet = useMemo(() => new Set(pantry), [pantry]);
  const currentPlan = weeklyPlan?.status === 'confirmed' ? weeklyPlan : proposal;

  const addCheckedNeedsToPantry = () => {
    if (!currentPlan || checkedNeeds.length === 0) return;
    const nextPantry = new Set([...pantry, ...checkedNeeds]);
    const nextPlan = recomputePlanGroceryNeeds(currentPlan, BUNDLED_CATALOG, nextPantry);
    addPantryItems(checkedNeeds);
    if (nextPlan.status === 'confirmed') setWeeklyPlan(nextPlan);
    else setProposal(nextPlan);
    clearPlanGroceryChecks();
  };

  useEffect(() => {
    void syncReminders(
      weeklyPlan?.status === 'confirmed' ? weeklyPlan : null,
      remindersEnabled,
      leadMinutes
    );
  }, [weeklyPlan, remindersEnabled, leadMinutes]);

  const generate = () => {
    setIsGenerating(true);
    try {
      const plan = planWeek({
        recipes: BUNDLED_CATALOG,
        pantry: pantrySet,
        preferences,
        days: buildWeekDays(prepStyle),
        tasteSignals: [],
        portionInput: { bodyProfile: null, satietyLevel: null },
      });
      setProposal(applyPlanPreferences(plan, days, variety, BUNDLED_CATALOG, pantrySet));
      setStep('proposal');
    } catch (error: unknown) {
      console.warn('[plan] Unable to generate weekly plan', error);
      Alert.alert('Couldn’t build a plan', 'Try again after checking your kitchen setup.');
    } finally {
      setIsGenerating(false);
    }
  };

  const confirm = async () => {
    if (!proposal) return;
    const confirmed = weeklyMealPlanSchema.parse({ ...proposal, status: 'confirmed' });
    setWeeklyPlan(confirmed);
    setStep('grocery');
  };

  const startOver = async () => {
    setWeeklyPlan(null);
    setProposal(null);
    setStep('days');
  };

  const swap = async (index: number) => {
    if (!currentPlan) return;
    const target = currentPlan.entries[index];
    if (!target || target.kind !== 'recipe') return;
    const usedIds = new Set(
      currentPlan.entries.flatMap((entry) => (entry.kind === 'recipe' ? [entry.recipeId] : []))
    );
    const replacement = BUNDLED_CATALOG.filter(
      (recipe) => recipe.id !== target.recipeId && !usedIds.has(recipe.id)
    )
      .filter((recipe) => isHardSafe(recipe, preferences))
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    if (!replacement) {
      Alert.alert(
        'No safe replacement found',
        'HomeChef could not find another meal for this day.'
      );
      return;
    }
    const entries = currentPlan.entries.map((entry, entryIndex) =>
      entryIndex === index && entry.kind === 'recipe'
        ? { ...entry, recipeId: replacement.id }
        : entry
    );
    let groceryNeeds;
    try {
      groceryNeeds = derivePlanLinkedGroceryNeeds(
        entries.flatMap((entry) => {
          if (entry.kind !== 'recipe') return [];
          const recipe = BUNDLED_CATALOG.find((candidate) => candidate.id === entry.recipeId);
          return recipe ? [{ date: entry.date, recipe }] : [];
        }),
        pantrySet,
        12
      );
    } catch {
      Alert.alert(
        'That swap needs too many ingredients',
        'Try another meal so What to get stays focused.'
      );
      return;
    }
    const next = weeklyMealPlanSchema.parse({ ...currentPlan, entries, groceryNeeds });
    if (next.status === 'confirmed') {
      setWeeklyPlan(next);
      await syncReminders(next, remindersEnabled, leadMinutes);
    } else {
      setProposal(next);
    }
  };

  if (step === 'grocery' && currentPlan) {
    return (
      <PlanSummary
        plan={currentPlan}
        pantry={pantrySet}
        checkedNeeds={checkedNeeds}
        onToggleNeed={toggleNeed}
        onAddChecked={addCheckedNeedsToPantry}
        onSwap={swap}
        onStartOver={startOver}
        remindersEnabled={remindersEnabled}
      />
    );
  }
  if (step === 'proposal' && proposal) {
    return (
      <PlanSummary
        plan={proposal}
        pantry={pantrySet}
        checkedNeeds={checkedNeeds}
        onToggleNeed={toggleNeed}
        onAddChecked={addCheckedNeedsToPantry}
        onSwap={swap}
        onConfirm={confirm}
        onStartOver={startOver}
        remindersEnabled={false}
      />
    );
  }

  return (
    <PlanStep
      step={step}
      days={days}
      prepStyle={prepStyle}
      variety={variety}
      isGenerating={isGenerating}
      onDays={(value) => {
        setDays(value);
        setStep('style');
      }}
      onStyle={(value) => {
        setPrepStyle(value);
        setStep('variety');
      }}
      onVariety={(value) => {
        setVariety(value);
        generate();
      }}
      onBack={() => {
        if (step === 'days') router.back();
        else setStep(step === 'style' ? 'days' : 'style');
      }}
    />
  );
}

function PlanStep({
  step,
  days,
  prepStyle,
  variety,
  isGenerating,
  onDays,
  onStyle,
  onVariety,
  onBack,
}: {
  step: Step;
  days: Days;
  prepStyle: PrepStyle;
  variety: Variety;
  isGenerating: boolean;
  onDays: (value: Days) => void;
  onStyle: (value: PrepStyle) => void;
  onVariety: (value: Variety) => void;
  onBack: () => void;
}) {
  const heading =
    step === 'days'
      ? 'How many days should we plan?'
      : step === 'style'
        ? 'How should the week feel?'
        : 'How much variety do you want?';
  const options =
    step === 'days' ? DAYS_OPTIONS : step === 'style' ? STYLE_OPTIONS : VARIETY_OPTIONS;
  return (
    <Screen
      header={
        <Header
          onBack={onBack}
          backLabel="Back"
          backAccessibilityLabel="Back"
          backHint="Returns to the previous planning question"
          rightAction={
            <Text variant="caption" tone="muted">
              Step {step === 'days' ? 1 : step === 'style' ? 2 : 3} of 3
            </Text>
          }
        />
      }
    >
      <View style={styles.header}>
        <Text variant="display">Plan my week</Text>
        <Text variant="body" tone="muted">
          {heading}
        </Text>
      </View>
      <View
        style={styles.group}
        accessibilityRole="radiogroup"
        accessibilityLabel={heading}
        accessibilityHint="Choose one option to continue"
      >
        {options.map((option) => (
          <SelectableCard
            key={String(option.value)}
            title={option.title}
            subtitle={option.subtitle}
            selected={
              option.value === (step === 'days' ? days : step === 'style' ? prepStyle : variety)
            }
            onPress={() => {
              if (step === 'days') onDays(option.value as Days);
              else if (step === 'style') onStyle(option.value as PrepStyle);
              else onVariety(option.value as Variety);
            }}
            accessibilityHint="Selects this planning preference and continues"
          />
        ))}
      </View>
      {isGenerating ? (
        <Text variant="caption" tone="muted">
          Building your week…
        </Text>
      ) : null}
    </Screen>
  );
}

function PlanSummary({
  plan,
  pantry,
  checkedNeeds,
  onToggleNeed,
  onAddChecked,
  onSwap,
  onConfirm,
  onStartOver,
  remindersEnabled,
}: {
  plan: WeeklyMealPlan;
  pantry: ReadonlySet<string>;
  checkedNeeds: readonly string[];
  onToggleNeed: (id: string) => void;
  onAddChecked: () => void;
  onSwap: (index: number) => void;
  onConfirm?: () => void;
  onStartOver: () => void;
  remindersEnabled: boolean;
}) {
  const router = useRouter();
  return (
    <Screen
      header={
        <Header
          onBack={onStartOver}
          backLabel="Change plan"
          backAccessibilityLabel="Change weekly plan"
          backHint="Clears this plan and any reminders before starting again"
          rightAction={
            <SettingsAction
              onPress={() => router.push('/settings')}
              accessibilityHint="Opens settings for reminder preferences"
            />
          }
        />
      }
    >
      <View style={styles.header}>
        <Text variant="display">
          {plan.status === 'confirmed' ? 'Your week' : 'Your proposed week'}
        </Text>
        <Text variant="body" tone="muted">
          {plan.status === 'confirmed'
            ? 'Your plan is saved. Here is everything it needs.'
            : 'One practical week, using the kitchen and pantry you already have.'}
        </Text>
      </View>
      <View style={styles.group}>
        {plan.entries.map((entry, index) => {
          const recipe =
            entry.kind === 'recipe'
              ? BUNDLED_CATALOG.find((candidate) => candidate.id === entry.recipeId)
              : undefined;
          const missingCount = recipe
            ? recipe.ingredients.filter((ingredient) => !pantry.has(ingredient.id)).length
            : 0;
          const accessibilityLabel =
            entry.kind === 'recipe'
              ? entry.date +
                ', ' +
                (recipe?.title ?? entry.recipeId) +
                ', ' +
                (recipe?.totalTimeMinutes ?? 0) +
                ' minutes'
              : entry.date +
                ', ' +
                (entry.reason === 'not_planned' ? 'Not planned' : 'Decide that day');
          return (
            <Card key={entry.date} variant="alt">
              <View
                accessible
                accessibilityLabel={accessibilityLabel}
                accessibilityHint="Shows the planned meal, time, and pantry fit"
                style={styles.mealRow}
              >
                <View style={styles.mealCopy}>
                  <Text variant="bodyStrong">{entry.date}</Text>
                  <Text variant="heading">
                    {entry.kind === 'recipe'
                      ? (recipe?.title ?? entry.recipeId)
                      : entry.reason === 'not_planned'
                        ? 'Not planned'
                        : 'Decide that day'}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {entry.kind === 'recipe'
                      ? (recipe?.totalTimeMinutes ?? 0) +
                        ' min · ' +
                        (missingCount === 0
                          ? 'Ready from your pantry'
                          : missingCount +
                            ' ingredient' +
                            (missingCount === 1 ? '' : 's') +
                            ' to get')
                      : entry.reason === 'not_planned'
                        ? 'Not planned'
                        : 'No safe match for this day'}
                  </Text>
                </View>
                {entry.kind === 'recipe' && (
                  <Pressable
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={'Replace meal on ' + entry.date}
                    accessibilityHint="Replaces one meal without changing the rest of your plan"
                    onPress={() => onSwap(index)}
                    style={styles.swapButton}
                  >
                    <Text variant="caption" tone="accent">
                      Swap
                    </Text>
                  </Pressable>
                )}
              </View>
            </Card>
          );
        })}
      </View>
      {plan.status === 'confirmed' ? (
        <View style={styles.group}>
          <Text variant="heading">What to get</Text>
          <Text variant="caption" tone="muted">
            Only ingredients missing from your pantry, grouped across this plan.
          </Text>
          {plan.groceryNeeds.length === 0 ? (
            <Card variant="alt">
              <Text variant="body">You have everything this plan needs.</Text>
            </Card>
          ) : (
            plan.groceryNeeds.map((need) => {
              const name = lookupIngredient(need.ingredientId)?.displayName ?? need.ingredientId;
              const mealNames = getPlanGroceryNeedMealNames(need, BUNDLED_CATALOG);
              const checked = checkedNeeds.includes(need.ingredientId);
              return (
                <Pressable
                  key={need.ingredientId}
                  accessible
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={name + ', used in ' + mealNames.join(', ')}
                  accessibilityHint="Marks this ingredient as purchased"
                  onPress={() => onToggleNeed(need.ingredientId)}
                  style={styles.needRow}
                >
                  <Text variant="bodyStrong">
                    {checked ? '✓ ' : '○ '}
                    {name}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {mealNames.join(', ')} · {need.dates.join(', ')}
                  </Text>
                </Pressable>
              );
            })
          )}
          {checkedNeeds.length > 0 ? (
            <PrimaryButton
              label="Add checked items to pantry"
              onPress={onAddChecked}
              accessibilityHint="Confirms purchased ingredients and adds them to your pantry"
            />
          ) : null}
          <PrimaryButton
            label="Open Reminders"
            variant="ghost"
            onPress={() => router.push('/reminders')}
            accessibilityHint="Opens reminders for this confirmed weekly plan"
          />
          {Platform.OS === 'web' ? (
            <Text variant="caption" tone="muted">
              Reminders are unavailable on the web. Your plan is still saved.
            </Text>
          ) : remindersEnabled ? (
            <Text variant="caption" tone="muted">
              Cooking reminders are scheduled from Settings.
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              Turn on reminders in Settings when you want cooking prompts.
            </Text>
          )}
        </View>
      ) : (
        <PrimaryButton
          label="Use this plan"
          onPress={onConfirm ?? (() => undefined)}
          accessibilityHint="Confirms this week and derives its What to get ingredients"
        />
      )}
    </Screen>
  );
}

async function syncReminders(
  plan: WeeklyMealPlan | null,
  enabled: boolean,
  leadMinutes: 0 | 10 | 15 | 30 | 60
) {
  const entries =
    plan?.entries.flatMap((entry) => {
      if (entry.kind !== 'recipe') return [];
      const recipe = BUNDLED_CATALOG.find((candidate) => candidate.id === entry.recipeId);
      return recipe
        ? [
            {
              id: entry.recipeId + ':' + entry.date,
              recipeId: recipe.id,
              recipeTitle: recipe.title,
              totalTimeMinutes: recipe.totalTimeMinutes,
              plannedMealTime: new Date(entry.plannedMealTime),
            },
          ]
        : [];
    }) ?? [];
  try {
    await syncMealPrepReminders(entries, { enabled, leadMinutes });
  } catch (error: unknown) {
    console.warn('[plan] Reminder sync failed; plan state is preserved', error);
  }
}

function buildWeekDays(style: PrepStyle): DailyPlanPreference[] {
  const start = new Date();
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, index) => {
    const dateValue = new Date(start);
    dateValue.setDate(start.getDate() + index);
    const date = [
      dateValue.getFullYear(),
      String(dateValue.getMonth() + 1).padStart(2, '0'),
      String(dateValue.getDate()).padStart(2, '0'),
    ].join('-');
    const offset = -dateValue.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absolute = Math.abs(offset);
    const zone =
      sign +
      String(Math.floor(absolute / 60)).padStart(2, '0') +
      ':' +
      String(absolute % 60).padStart(2, '0');
    return {
      date,
      selectedLimit: style === 'quick' ? 30 : style === 'batch' ? 120 : 60,
      mealTime: '18:30:00' + zone,
    };
  });
}

function isHardSafe(recipe: Recipe, preferences: ReturnType<typeof toEnginePreferences>) {
  return (
    recipe.source === 'bundled' &&
    !preferences.dislikedRecipeIds.has(recipe.id) &&
    isEquipmentSatisfied(recipe.equipmentRequired, preferences.equipment) &&
    !hasAllergen(recipe, preferences.allergens) &&
    satisfiesDietary(recipe, preferences.dietary)
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  group: { gap: space.sm },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mealCopy: { flex: 1, gap: 2 },
  swapButton: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  needRow: {
    minHeight: 56,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#d8cec2',
  },
});
