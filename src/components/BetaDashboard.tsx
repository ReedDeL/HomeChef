import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { STAPLE_INGREDIENT_IDS, TIER1_CATALOG, lookupIngredient } from '@/data/catalog';
import { decideWithRelaxation } from '@/engine/relax';
import type { Bucket, Equipment, Relaxation, ScoredRecipe, UserPreferences } from '@/engine/types';
import { palette, radius, space, touchTarget, type as typeScale } from '@/theme/tokens';

type Theme = (typeof palette)['light'] | (typeof palette)['dark'];

const TIME_OPTIONS = [15, 30, 60, 120] as const;

const EQUIPMENT_PRESETS: readonly { id: string; label: string; equipment: readonly Equipment[] }[] =
  [
    { id: 'microwave', label: 'Microwave only', equipment: ['microwave'] },
    { id: 'dorm', label: 'Microwave + kettle', equipment: ['microwave', 'kettle'] },
    {
      id: 'full',
      label: 'Full kitchen',
      equipment: [
        'microwave',
        'stove',
        'oven',
        'air_fryer',
        'kettle',
        'blender',
        'rice_cooker',
        'toaster_oven',
      ],
    },
  ];

const PANTRY_PRESETS: readonly { id: string; label: string; ingredientIds: readonly string[] }[] = [
  { id: 'staples', label: 'Staples', ingredientIds: STAPLE_INGREDIENT_IDS.slice(0, 8) },
  {
    id: 'dorm',
    label: 'Dorm basics',
    ingredientIds: dedupe([
      ...STAPLE_INGREDIENT_IDS,
      'egg',
      'rice',
      'chicken',
      'milk',
      'butter',
      'salt',
      'onion',
      'garlic',
      'flour',
      'tomato',
      'pasta',
      'bread',
    ]),
  },
  {
    id: 'full',
    label: 'Full starter',
    ingredientIds: dedupe([
      ...STAPLE_INGREDIENT_IDS,
      'egg',
      'rice',
      'chicken',
      'milk',
      'butter',
      'salt',
      'onion',
      'garlic',
      'flour',
      'tomato',
      'pasta',
      'bread',
      'cheese',
      'carrot',
      'potato',
    ]),
  },
];

const COMMON_INGREDIENT_IDS = dedupe([
  ...STAPLE_INGREDIENT_IDS,
  'egg',
  'rice',
  'chicken',
  'milk',
  'butter',
  'salt',
  'onion',
  'garlic',
  'flour',
  'tomato',
  'pasta',
  'bread',
  'cheese',
  'carrot',
  'potato',
]);

const DEFAULT_EQUIPMENT_PRESET = EQUIPMENT_PRESETS[1]!;

export function BetaDashboard() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? palette.dark : palette.light;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [timeLimit, setTimeLimit] = useState<(typeof TIME_OPTIONS)[number]>(30);
  const [equipmentPresetId, setEquipmentPresetId] = useState('dorm');
  const [pantryPresetId, setPantryPresetId] = useState('dorm');
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(
    () => new Set(findPantryPreset('dorm')?.ingredientIds ?? [])
  );

  const equipmentPreset = findEquipmentPreset(equipmentPresetId) ?? DEFAULT_EQUIPMENT_PRESET;

  const preferences = useMemo<UserPreferences>(
    () => ({
      equipment: [...equipmentPreset.equipment],
      allergens: [],
      dietary: [],
      dislikedRecipeIds: new Set<string>(),
      skippedRecipeIds: new Set<string>(),
      preferredCuisine: null,
    }),
    [equipmentPreset]
  );

  const decision = useMemo(
    () => decideWithRelaxation(TIER1_CATALOG, selectedIngredients, preferences, timeLimit),
    [preferences, selectedIngredients, timeLimit]
  );

  const selectedCount = selectedIngredients.size;
  const totalRecipes = Object.values(decision.buckets).reduce(
    (sum, bucket) => sum + bucket.length,
    0
  );
  const relaxationText = decision.appliedRelaxations.map(formatRelaxation).join(' · ');

  function toggleIngredient(id: string) {
    setSelectedIngredients((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyPantryPreset(id: string) {
    const preset = findPantryPreset(id);
    if (!preset) return;
    setPantryPresetId(id);
    setSelectedIngredients(new Set(preset.ingredientIds));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Browser beta preview</Text>
          <Text style={styles.title}>HomeChef decision engine</Text>
          <Text style={styles.body}>
            This harness exercises the bundled catalog and pure engine in the browser. Photos,
            Supabase, and voice are not wired here yet.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Time</Text>
          <View style={styles.chipRow}>
            {TIME_OPTIONS.map((option) => (
              <ChoiceChip
                key={option}
                label={`${option} min`}
                selected={option === timeLimit}
                onPress={() => setTimeLimit(option)}
                styles={styles}
                accessibilityLabel={`Set time limit to ${option} minutes`}
                accessibilityHint="Updates the results buckets for the selected time"
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Equipment</Text>
          <View style={styles.chipRow}>
            {EQUIPMENT_PRESETS.map((preset) => (
              <ChoiceChip
                key={preset.id}
                label={preset.label}
                selected={preset.id === equipmentPresetId}
                onPress={() => setEquipmentPresetId(preset.id)}
                styles={styles}
                accessibilityLabel={`Select ${preset.label} equipment preset`}
                accessibilityHint="Changes which recipes count as cookable"
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pantry preset</Text>
            <Text style={styles.caption}>{selectedCount} ingredients selected</Text>
          </View>
          <View style={styles.chipRow}>
            {PANTRY_PRESETS.map((preset) => (
              <ChoiceChip
                key={preset.id}
                label={preset.label}
                selected={preset.id === pantryPresetId}
                onPress={() => applyPantryPreset(preset.id)}
                styles={styles}
                accessibilityLabel={`Load ${preset.label} pantry preset`}
                accessibilityHint="Replaces the selected pantry ingredients"
              />
            ))}
          </View>
          <View style={styles.ingredientGrid}>
            {COMMON_INGREDIENT_IDS.map((id) => {
              const label = lookupIngredient(id)?.displayName ?? id;
              const selected = selectedIngredients.has(id);
              return (
                <ChoiceChip
                  key={id}
                  label={label}
                  selected={selected}
                  onPress={() => toggleIngredient(id)}
                  styles={styles}
                  accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${label}`}
                  accessibilityHint="Toggles a pantry ingredient"
                />
              );
            })}
          </View>
        </View>

        {decision.appliedRelaxations.length > 0 ? (
          <View style={[styles.card, styles.banner]}>
            <Text style={styles.bannerTitle}>Relaxation used</Text>
            <Text style={styles.body}>{relaxationText}</Text>
          </View>
        ) : null}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalRecipes}</Text>
            <Text style={styles.caption}>recipes shown</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{decision.buckets.ready.length}</Text>
            <Text style={styles.caption}>ready now</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{equipmentPreset.label}</Text>
            <Text style={styles.caption}>equipment</Text>
          </View>
        </View>

        {(
          [
            ['ready', 'Make it now'],
            ['missing_few', 'Missing a few'],
            ['missing_some', 'Missing more'],
            ['grocery_run', 'Grocery run'],
          ] as const
        ).map(([bucket, title]) => (
          <BucketSection
            key={bucket}
            bucket={bucket}
            title={title}
            recipes={decision.buckets[bucket]}
            styles={styles}
          />
        ))}

        {totalRecipes === 0 ? (
          <View style={[styles.card, styles.banner]}>
            <Text style={styles.bannerTitle}>No Tier 1 results</Text>
            <Text style={styles.body}>
              The full app would escalate to Tier 2 here. This beta harness stays local so the web
              preview can still be tested offline.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  accessibilityLabel: string;
  accessibilityHint: string;
}

function ChoiceChip({
  label,
  selected,
  onPress,
  styles,
  accessibilityLabel,
  accessibilityHint,
}: ChoiceChipProps) {
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

interface BucketSectionProps {
  bucket: Bucket;
  title: string;
  recipes: readonly ScoredRecipe[];
  styles: ReturnType<typeof createStyles>;
}

function BucketSection({ bucket, title, recipes, styles }: BucketSectionProps) {
  return (
    <View style={styles.bucket}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.bucketTitle, bucketTitleStyle(styles, bucket)]}>{title}</Text>
        <Text style={styles.caption}>{recipes.length}</Text>
      </View>
      {recipes.length > 0 ? (
        recipes.map(({ recipe, missing }) => (
          <View key={recipe.id} style={styles.recipeCard}>
            <Text style={styles.recipeTitle}>{recipe.title}</Text>
            <Text style={styles.caption}>{recipe.totalTimeMinutes} min</Text>
            <Text style={styles.bodyMuted}>{formatEquipment(recipe.equipmentRequired)}</Text>
            <Text style={styles.bodyMuted}>
              {missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'You have it all'}
            </Text>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.bodyMuted}>No recipes in this bucket for the current setup.</Text>
        </View>
      )}
    </View>
  );
}

function bucketTitleStyle(styles: ReturnType<typeof createStyles>, bucket: Bucket) {
  switch (bucket) {
    case 'ready':
      return styles.bucketTitleReady;
    case 'missing_few':
      return styles.bucketTitleNear;
    case 'missing_some':
      return styles.bucketTitleFar;
    case 'grocery_run':
      return styles.bucketTitleFar;
  }
}

function formatEquipment(equipment: readonly Equipment[]): string {
  return equipment.map((item) => item.replaceAll('_', ' ')).join(' · ');
}

function formatRelaxation(relaxation: Relaxation): string {
  switch (relaxation.kind) {
    case 'time_widened':
      return `Time widened from ${relaxation.from} to ${relaxation.to} minutes`;
    case 'cuisine_dropped':
      return `Dropped ${relaxation.cuisine}`;
    case 'tier2_escalation':
      return 'Tier 2 escalation';
    case 'bucket_promoted':
      return `${relaxation.bucket.replace('_', ' ')} promoted`;
  }
}

function findEquipmentPreset(id: string) {
  return EQUIPMENT_PRESETS.find((preset) => preset.id === id);
}

function findPantryPreset(id: string) {
  return PANTRY_PRESETS.find((preset) => preset.id === id);
}

function dedupe(ids: readonly string[]): readonly string[] {
  return [...new Set(ids.filter((id) => lookupIngredient(id) !== undefined))];
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    content: {
      padding: space.lg,
      gap: space.lg,
      backgroundColor: theme.bg,
    },
    hero: {
      gap: space.sm,
      padding: space.lg,
      borderRadius: radius.lg,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    kicker: {
      ...typeScale.caption,
      color: theme.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    title: {
      ...typeScale.display,
      color: theme.text,
    },
    body: {
      ...typeScale.body,
      color: theme.text,
    },
    bodyMuted: {
      ...typeScale.body,
      color: theme.textMuted,
    },
    caption: {
      ...typeScale.caption,
      color: theme.textMuted,
    },
    card: {
      gap: space.md,
      padding: space.lg,
      borderRadius: radius.lg,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      ...typeScale.heading,
      color: theme.text,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.md,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.sm,
    },
    ingredientGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.sm,
    },
    chip: {
      minHeight: touchTarget.standard,
      paddingHorizontal: space.md,
      borderRadius: radius.full,
      borderWidth: 1,
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    chipUnselected: {
      backgroundColor: theme.surfaceAlt,
      borderColor: theme.border,
    },
    chipText: {
      ...typeScale.caption,
      color: theme.text,
      fontWeight: '600',
    },
    chipTextSelected: {
      color: theme.accentText,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: space.sm,
    },
    summaryCard: {
      flex: 1,
      gap: 2,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    summaryValue: {
      ...typeScale.heading,
      color: theme.text,
    },
    banner: {
      borderColor: theme.accent,
      backgroundColor: theme.surfaceAlt,
    },
    bannerTitle: {
      ...typeScale.heading,
      color: theme.accent,
    },
    bucket: {
      gap: space.sm,
    },
    bucketTitle: {
      ...typeScale.heading,
      fontWeight: '700',
    },
    bucketTitleReady: {
      color: theme.ready,
    },
    bucketTitleNear: {
      color: theme.near,
    },
    bucketTitleFar: {
      color: theme.far,
    },
    recipeCard: {
      gap: 2,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    recipeTitle: {
      ...typeScale.bodyStrong,
      color: theme.text,
    },
    emptyState: {
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: theme.surfaceAlt,
    },
  });
}
