import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { MealSatietyCheckIn } from '@/components/ui/MealSatietyCheckIn';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TIER1_CATALOG } from '@/data/catalog';
import {
  cookCompletionReducer,
  INITIAL_COOK_COMPLETION,
  planCookCompletionExit,
  type MealVerdict,
} from '@/lib/cook-completion';
import { supabase } from '@/lib/supabase';
import { recordMealSatiety } from '@/lib/queries/preferences';
import { useKitchenStore } from '@/store/kitchen';
import { radius, space, touchTarget, type as typeScale } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { MealSatietyLevel } from '@/types/database';

/**
 * Spec §7 — Cook Mode: hands-free-ish, one step at a time.
 * Sized with 64×64 minimum touch targets for a knuckle or back of hand.
 */
export default function CookModeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { color } = useTheme();

  const removePantryItem = useKitchenStore((state) => state.removePantryItem);

  const recipe = useMemo(() => TIER1_CATALOG.find((candidate) => candidate.id === id), [id]);

  const steps = useMemo(() => {
    if (!recipe) return [];
    return recipe.instructions
      .split(/\r?\n+/)
      .map((step) => step.trim())
      .filter((step) => step.length > 0);
  }, [recipe]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completion, dispatchCompletion] = useReducer(
    cookCompletionReducer,
    INITIAL_COOK_COMPLETION
  );

  // Timer state for current step if duration detected
  const currentStepText = steps[currentStepIndex] ?? '';
  const parsedSeconds = useMemo(() => parseDurationSeconds(currentStepText), [currentStepText]);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number | null>(parsedSeconds);
  const [timerRunning, setTimerRunning] = useState(false);

  // Reset timer when step changes
  useEffect(() => {
    setTimerSecondsLeft(parsedSeconds);
    setTimerRunning(false);
  }, [parsedSeconds, currentStepIndex]);

  useEffect(() => {
    if (!timerRunning || timerSecondsLeft === null || timerSecondsLeft <= 0) return;

    const interval = setInterval(() => {
      setTimerSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, timerSecondsLeft]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      dispatchCompletion({ type: 'finish_cooking' });
    }
  }, [currentStepIndex, steps.length]);

  const handleBack = useCallback(() => {
    if (completion.step !== 'cooking') {
      dispatchCompletion({ type: 'back' });
    } else if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [completion.step, currentStepIndex]);

  const handleVerdict = useCallback((verdict: MealVerdict) => {
    dispatchCompletion({ type: 'select_verdict', verdict });
  }, []);

  const finishCompletion = useCallback(() => {
    const ingredientIds = recipe?.ingredients.map((ingredient) => ingredient.id) ?? [];
    const exit = planCookCompletionExit(completion, ingredientIds);

    for (const ingredientId of exit.pantryIngredientIdsToRemove) {
      removePantryItem(ingredientId);
    }
    router.replace('/');
  }, [completion, recipe, removePantryItem, router]);

  const satietyMutation = useMutation({
    mutationFn: async (level: MealSatietyLevel) => {
      if (!recipe) throw new Error('Recipe not found.');

      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user) throw new Error('Sign in is required to save a hunger stat.');
      await recordMealSatiety(data.user.id, recipe.id, level);
    },
    onSuccess: finishCompletion,
  });

  if (!recipe || steps.length === 0) {
    return (
      <Screen>
        <Text variant="title">Recipe not found.</Text>
        <PrimaryButton
          label="Back to home"
          onPress={() => router.replace('/')}
          accessibilityHint="Returns to home screen"
        />
      </Screen>
    );
  }

  if (completion.step === 'satiety') {
    return (
      <Screen>
        <MealSatietyCheckIn
          recipeTitle={recipe.title}
          isSaving={satietyMutation.isPending}
          errorMessage={satietyMutation.isError ? 'Unable to save hunger stat.' : null}
          onBack={handleBack}
          onSave={satietyMutation.mutate}
          onSkip={finishCompletion}
        />
      </Screen>
    );
  }

  if (completion.step === 'verdict') {
    return (
      <Screen
        footer={
          <View style={styles.footer}>
            <PrimaryButton
              label="Back to results"
              onPress={finishCompletion}
              accessibilityHint="Finishes cook mode and returns to results"
            />
          </View>
        }
      >
        <View style={styles.completedIntro}>
          <Text variant="display">Did you like it?</Text>
          <Text variant="body" tone="muted">
            {recipe.title}
          </Text>
        </View>

        <Card variant="alt">
          <View style={styles.ratingRow}>
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel="Thumbs up, liked it"
              accessibilityHint="Records positive feedback and deducts used pantry ingredients"
              onPress={() => handleVerdict('loved')}
              style={[
                styles.rateButton,
                { backgroundColor: color.surface, borderColor: color.border },
              ]}
            >
              <Text style={styles.emojiText}>👍</Text>
              <Text variant="bodyStrong" tone="ready">
                Loved it
              </Text>
            </Pressable>

            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel="Thumbs down, did not like"
              accessibilityHint="Records feedback and keeps pantry unchanged"
              onPress={() => handleVerdict('not_great')}
              style={[
                styles.rateButton,
                { backgroundColor: color.surface, borderColor: color.border },
              ]}
            >
              <Text style={styles.emojiText}>👎</Text>
              <Text variant="bodyStrong" tone="muted">
                Not great
              </Text>
            </Pressable>
          </View>

          <Text variant="caption" tone="muted" style={styles.centeredNote}>
            Selecting &ldquo;Loved it&rdquo; will automatically remove the recipe&apos;s ingredients
            from your pantry inventory.
          </Text>
        </Card>

        <PrimaryButton
          label="← Review steps"
          variant="ghost"
          onPress={handleBack}
          accessibilityHint="Returns to review previous cooking steps"
        />
      </Screen>
    );
  }

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <Screen
      footer={
        <View style={styles.navigationRow}>
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={isFirstStep ? 'Exit cook mode' : 'Previous step'}
            accessibilityHint={
              isFirstStep ? 'Returns to recipe view' : 'Moves to the previous cooking step'
            }
            onPress={isFirstStep ? () => router.back() : handleBack}
            style={({ pressed }) => [
              styles.cookNavButton,
              styles.cookNavBack,
              {
                borderColor: color.border,
                backgroundColor: color.surface,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text variant="bodyStrong" tone="default">
              ‹ Back
            </Text>
          </Pressable>

          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={isLastStep ? 'Finish cooking' : 'Next step'}
            accessibilityHint={
              isLastStep ? 'Opens meal completion survey' : 'Moves to the next step'
            }
            onPress={handleNext}
            style={({ pressed }) => [
              styles.cookNavButton,
              styles.cookNavForward,
              {
                backgroundColor: color.accent,
                borderColor: color.accent,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text variant="bodyStrong" tone="onAccent">
              {isLastStep ? 'Finish ✓' : 'Next ›'}
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.topHeader}>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="Close cook mode"
          accessibilityHint="Exits cook mode and returns to recipe screen"
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Text variant="heading" tone="muted">
            ✕
          </Text>
        </Pressable>

        <View style={styles.stepBadge}>
          <Text variant="caption" tone="accent">
            Step {currentStepIndex + 1} of {steps.length}
          </Text>
        </View>
      </View>

      <View style={styles.stepContent} aria-live="polite">
        <Text style={[styles.cookStepText, { color: color.text }]}>{currentStepText}</Text>
      </View>

      {parsedSeconds !== null && timerSecondsLeft !== null ? (
        <Card variant="alt">
          <View style={styles.timerContainer}>
            <Text variant="caption" tone="muted">
              Step Timer
            </Text>
            <Text variant="display" tone={timerSecondsLeft === 0 ? 'ready' : 'default'}>
              {formatTimer(timerSecondsLeft)}
            </Text>
            <View style={styles.timerControls}>
              <PrimaryButton
                label={timerRunning ? 'Pause ⏸' : timerSecondsLeft === 0 ? 'Restart ↺' : 'Start ▶'}
                onPress={() => {
                  if (timerSecondsLeft === 0) {
                    setTimerSecondsLeft(parsedSeconds);
                    setTimerRunning(true);
                  } else {
                    setTimerRunning((prev) => !prev);
                  }
                }}
                accessibilityHint="Controls the countdown timer for this step"
              />
              {timerRunning || (timerSecondsLeft !== parsedSeconds && timerSecondsLeft > 0) ? (
                <PrimaryButton
                  label="Reset"
                  variant="ghost"
                  onPress={() => {
                    setTimerRunning(false);
                    setTimerSecondsLeft(parsedSeconds);
                  }}
                  accessibilityHint="Resets the timer back to beginning"
                />
              ) : null}
            </View>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

/** Helper to parse durations like "90 seconds", "5 minutes", "1 hour" from instruction text. */
function parseDurationSeconds(text: string): number | null {
  const match =
    text.match(/(\d+)\s*(?:-|to)?\s*(\d+)?\s*(mins?|minutes?|secs?|seconds?|hrs?|hours?)/i) ??
    text.match(/(?:about|for)\s*(\d+)\s*(mins?|minutes?|secs?|seconds?|hrs?|hours?)/i);

  if (!match) return null;

  const first = match[1];
  const second = match[2];
  const third = match[3];

  const numStr = second && !isNaN(Number(second)) ? second : first;
  if (!numStr) return null;

  const rawNum = parseInt(numStr, 10);
  if (isNaN(rawNum) || rawNum <= 0) return null;

  const unitStr = third ?? second ?? first;
  if (!unitStr) return null;
  const unit = unitStr.toLowerCase();

  if (unit.startsWith('sec')) return rawNum;
  if (unit.startsWith('min')) return rawNum * 60;
  if (unit.startsWith('hr') || unit.startsWith('hour')) return rawNum * 3600;

  return null;
}

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  closeButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  stepBadge: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.full,
  },
  stepContent: {
    minHeight: 180,
    justifyContent: 'center',
    paddingVertical: space.md,
  },
  cookStepText: {
    fontSize: typeScale.cookStep.fontSize,
    lineHeight: typeScale.cookStep.lineHeight,
    fontWeight: '500',
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    width: '100%',
  },
  cookNavButton: {
    minHeight: touchTarget.cookMode,
    height: touchTarget.cookMode,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  cookNavBack: {
    flex: 1,
  },
  cookNavForward: {
    flex: 2,
  },
  timerContainer: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  timerControls: {
    flexDirection: 'row',
    gap: space.sm,
    width: '100%',
  },
  completedIntro: {
    gap: space.xs,
    alignItems: 'center',
    textAlign: 'center',
    marginVertical: space.lg,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: space.md,
    justifyContent: 'space-between',
  },
  rateButton: {
    flex: 1,
    minHeight: 90,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  emojiText: {
    fontSize: 32,
  },
  centeredNote: {
    textAlign: 'center',
    marginTop: space.sm,
  },
  footer: {
    gap: space.sm,
  },
});
