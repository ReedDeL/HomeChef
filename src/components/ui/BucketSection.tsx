import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RecipeCard } from '@/components/ui/RecipeCard';
import { Text } from '@/components/ui/Text';
import type { Bucket, ScoredRecipe } from '@/engine/types';
import { space } from '@/theme/tokens';

/**
 * Truncation is the product. A "show more" link inside the top
 * buckets would rebuild the paralysis this app exists to remove, so the cap is
 * enforced here — at the only place buckets are rendered — rather than trusted
 * to each caller.
 */
export const MAX_CARDS_PER_BUCKET = 4;

interface BucketMeta {
  title: string;
  marker: string;
  tone: 'ready' | 'near' | 'far';
  /** The bottom two exist for completeness, not for browsing. */
  collapsedByDefault: boolean;
}

const BUCKET_META: Record<Bucket, BucketMeta> = {
  ready: { title: 'Make it now', marker: '✅', tone: 'ready', collapsedByDefault: false },
  missing_few: { title: 'Missing a few', marker: '🟡', tone: 'near', collapsedByDefault: false },
  missing_some: { title: 'Missing more', marker: '⚪', tone: 'far', collapsedByDefault: true },
  grocery_run: { title: 'Grocery run', marker: '⚪', tone: 'far', collapsedByDefault: true },
};

interface BucketSectionProps {
  bucket: Bucket;
  recipes: readonly ScoredRecipe[];
  onSelectRecipe: (recipeId: string) => void;
}

export function BucketSection({ bucket, recipes, onSelectRecipe }: BucketSectionProps) {
  const meta = BUCKET_META[bucket];
  const [expanded, setExpanded] = useState(!meta.collapsedByDefault);

  // An empty bucket is not a dead end, it is simply not shown — the screen as a
  // whole is guaranteed non-empty by the relaxation ladder (spec §5.3).
  if (recipes.length === 0) return null;

  const visible = expanded ? recipes.slice(0, MAX_CARDS_PER_BUCKET) : [];

  return (
    <View style={styles.section}>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${meta.title}, ${recipes.length} ${
          recipes.length === 1 ? 'recipe' : 'recipes'
        }`}
        accessibilityHint={expanded ? 'Collapses this group' : 'Expands this group'}
        onPress={() => setExpanded((current) => !current)}
        style={styles.header}
      >
        <Text variant="heading" tone={meta.tone} style={styles.title}>
          {meta.marker} {meta.title.toUpperCase()}
        </Text>
        <Text variant="caption" tone="muted">
          {recipes.length} {expanded ? '▴' : '▾'}
        </Text>
      </Pressable>

      {visible.map((scored) => (
        <RecipeCard key={scored.recipe.id} scored={scored} onPress={onSelectRecipe} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: 44,
  },
  title: { letterSpacing: 0.5 },
});
