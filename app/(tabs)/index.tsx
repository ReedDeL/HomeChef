import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BucketSection } from '@/components/ui/BucketSection';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RelaxationBanner } from '@/components/ui/RelaxationBanner';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { OFFLINE_TRANSITIONAL_CATALOG } from '@/data/catalog';
import { decide } from '@/engine/decide';
import { decideWithRelaxation } from '@/engine/relax';
import type { Bucket, Minutes } from '@/engine/types';
import {
  buildHostedCatalogCandidateRequest,
  catalogRecipeCache,
  mergeCatalogCandidates,
} from '@/lib/catalog';
import { CUISINE_OPTIONS } from '@/lib/cuisines';
import { formatDuration } from '@/lib/format';
import { useCatalogCandidates } from '@/lib/queries/catalog';
import { TimeTile } from '@/components/ui/TimeTile';
import { toEnginePreferences, useKitchenStore } from '@/store/kitchen';
import { space } from '@/theme/tokens';

/**
 * Spec §4 and §5 — the decision screen, before and after the one input it
 * requires.
 *
 * These are one screen rather than two because the transition is the product:
 * "I don't know what to eat" becomes three answers without a navigation event
 * in between. Time is the only required input; everything else on the screen
 * is visually subordinate to it, which is the time-first wedge made literal in
 * the layout.
 */

/** Spec §4: three tiles, not a slider. A slider is a decision. */
const TIME_CHOICES: readonly { minutes: Minutes; openEnded: boolean }[] = [
  { minutes: 15, openEnded: false },
  { minutes: 30, openEnded: false },
  { minutes: 60, openEnded: true },
];

const BUCKET_ORDER: readonly Bucket[] = ['ready', 'missing_few', 'missing_some', 'grocery_run'];

export default function HomeScreen() {
  const router = useRouter();

  const tierId = useKitchenStore((state) => state.tierId);
  const extras = useKitchenStore((state) => state.extras);
  const allergens = useKitchenStore((state) => state.allergens);
  const dietary = useKitchenStore((state) => state.dietary);
  const pantry = useKitchenStore((state) => state.pantry);

  const [timeLimit, setTimeLimit] = useState<Minutes | null>(null);
  const [cuisine, setCuisine] = useState<string | null>(null);
  /**
   * The user pressed undo on the relaxation banner, so the soft constraint they
   * chose is honoured exactly — even though that returns fewer answers.
   */
  const [strict, setStrict] = useState(false);

  const preferences = useMemo(
    () => toEnginePreferences({ tierId, extras, allergens, dietary }, cuisine),
    [tierId, extras, allergens, dietary, cuisine]
  );

  const pantrySet = useMemo(() => new Set(pantry), [pantry]);

  const catalogRequest = useMemo(
    () =>
      timeLimit === null
        ? null
        : buildHostedCatalogCandidateRequest({ pantryIngredientIds: pantry, preferences }),
    [pantry, preferences, timeLimit]
  );
  const hostedCandidates = useCatalogCandidates(catalogRequest);

  useEffect(() => {
    if (hostedCandidates.data) catalogRecipeCache.setCandidates(hostedCandidates.data);
  }, [hostedCandidates.data]);

  const catalog = useMemo(
    () => mergeCatalogCandidates(OFFLINE_TRANSITIONAL_CATALOG, hostedCandidates.data ?? []),
    [hostedCandidates.data]
  );

  const decision = useMemo(() => {
    if (timeLimit === null) return null;
    if (strict) {
      // `decide` never relaxes, so this can legitimately come back empty. That
      // is the one empty state the product allows, because the user asked for
      // it explicitly and can undo it — unlike an app that dead-ends on its own.
      return { ...decide(catalog, pantrySet, preferences, timeLimit), relaxed: false };
    }
    return {
      ...decideWithRelaxation(catalog, pantrySet, preferences, timeLimit),
      relaxed: true,
    };
  }, [catalog, timeLimit, pantrySet, preferences, strict]);

  const totalResults = decision
    ? BUCKET_ORDER.reduce((sum, bucket) => sum + decision.buckets[bucket].length, 0)
    : 0;

  if (decision === null || timeLimit === null) {
    return (
      <TimePrompt
        pantryCount={pantry.length}
        cuisine={cuisine}
        onSelectCuisine={setCuisine}
        onChooseTime={setTimeLimit}
        onOpenPantry={() => router.push('/pantry')}
      />
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.topBar}>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${formatDuration(timeLimit)}. Change the time.`}
          accessibilityHint="Returns to the time picker"
          onPress={() => {
            setTimeLimit(null);
            setStrict(false);
          }}
          style={styles.backRow}
        >
          <Text variant="heading" tone="accent">
            ‹ {formatDuration(timeLimit)}
          </Text>
        </Pressable>

        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="Settings"
          accessibilityHint="Opens app settings for theme, kitchen, and dietary preferences"
          onPress={() => router.push('/settings')}
          style={styles.settingsButton}
        >
          <Text variant="caption" tone="accent">
            ⚙️ Settings
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.results} showsVerticalScrollIndicator={false}>
        <RelaxationBanner
          relaxations={decision.appliedRelaxations}
          revertLabel={`Keep ${formatDuration(timeLimit)}`}
          onRevert={() => setStrict(true)}
        />

        {BUCKET_ORDER.map((bucket) => (
          <BucketSection
            key={bucket}
            bucket={bucket}
            recipes={decision.buckets[bucket]}
            onSelectRecipe={(recipeId) => router.push(`/recipe/${recipeId}`)}
          />
        ))}

        {totalResults === 0 ? (
          <Card variant="alt">
            <Text variant="heading">Nothing fits {formatDuration(timeLimit)} exactly.</Text>
            <Text variant="body" tone="muted">
              You asked us to hold that limit, so we did. We can widen it slightly instead.
            </Text>
            <PrimaryButton
              label="Show me what's close"
              onPress={() => setStrict(false)}
              accessibilityHint="Widens the time limit and shows results again"
            />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

interface TimePromptProps {
  pantryCount: number;
  cuisine: string | null;
  onSelectCuisine: (cuisine: string | null) => void;
  onChooseTime: (minutes: Minutes) => void;
  onOpenPantry: () => void;
}

function TimePrompt({
  pantryCount,
  cuisine,
  onSelectCuisine,
  onChooseTime,
  onOpenPantry,
}: TimePromptProps) {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.topRow}>
        <Text variant="caption" tone="muted">
          {greeting()}
        </Text>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="Settings"
          accessibilityHint="Opens app settings for theme, kitchen, and dietary preferences"
          onPress={() => router.push('/settings')}
          style={styles.settingsButton}
        >
          <Text variant="caption" tone="accent">
            ⚙️ Settings
          </Text>
        </Pressable>
      </View>

      <Text variant="display">How much time do you have?</Text>

      <View style={styles.tileRow}>
        {TIME_CHOICES.map((choice) => (
          <TimeTile
            key={choice.minutes}
            minutes={choice.minutes}
            openEnded={choice.openEnded}
            selected={false}
            onPress={onChooseTime}
          />
        ))}
      </View>

      <View style={styles.optional}>
        <Text variant="caption" tone="muted">
          Feeling like something?
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cuisineRow}
        >
          <Chip
            label="Any"
            selected={cuisine === null}
            onPress={() => onSelectCuisine(null)}
            accessibilityLabel="Any cuisine"
            accessibilityHint="Removes the cuisine preference"
          />
          {CUISINE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={cuisine === option.value}
              onPress={() => onSelectCuisine(cuisine === option.value ? null : option.value)}
              accessibilityLabel={option.label}
              accessibilityHint="Prefers this cuisine, but never at the cost of an empty screen"
            />
          ))}
        </ScrollView>
      </View>

      <PrimaryButton
        label="Show me meals"
        onPress={() => onChooseTime(30)}
        accessibilityHint="Shows meals you can make in 30 minutes"
      />

      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Pantry, ${pantryCount} items`}
        accessibilityHint="Opens your pantry to add or correct ingredients"
        onPress={onOpenPantry}
        style={styles.pantryLink}
      >
        <Text variant="caption" tone="muted">
          Pantry · {pantryCount} {pantryCount === 1 ? 'item' : 'items'}
        </Text>
      </Pressable>
    </Screen>
  );
}

/** The 6pm user is the one this product is for; the greeting says we noticed. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  tileRow: { flexDirection: 'row', gap: space.sm },
  optional: { gap: space.sm },
  cuisineRow: { flexDirection: 'row', gap: space.sm, paddingRight: space.lg },
  pantryLink: { minHeight: 44, justifyContent: 'center' },
  backRow: { minHeight: 44, justifyContent: 'center' },
  results: { gap: space.lg, paddingBottom: space.xl },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
  },
  settingsButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});
