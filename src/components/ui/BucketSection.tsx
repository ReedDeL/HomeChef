import { useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { RecipeCard } from '@/components/ui/RecipeCard';
import { getResponsiveLayout } from '@/components/ui/responsive-layout';
import { Text } from '@/components/ui/Text';
import type { Bucket, ScoredRecipe } from '@/engine/types';
import { space } from '@/theme/tokens';

/**
 * Truncation is the product (Technical Spec §4.1, B4). A "show more" link inside the top
 * buckets would rebuild the paralysis this app exists to remove, so the cap is
 * enforced here — at the only place buckets are rendered — rather than trusted
 * to each caller.
 */
export const MAX_CARDS_PER_BUCKET = 4;

interface BucketMeta {
  title: string;
  marker: string;
  tone: 'ready' | 'near' | 'far';
  /** The bottom two exist for completeness, not for browsing (Technical Spec §4.1). */
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
  const { width } = useWindowDimensions();
  const responsive = getResponsiveLayout(Platform.OS === 'web' ? width : 0);

  // An empty bucket is not a dead end, it is simply not shown — the screen as a
  // whole is guaranteed non-empty by the relaxation ladder (Technical Spec §4.3).
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

      <View
        style={[
          styles.cards,
          responsive.isDesktop && styles.desktopCards,
          responsive.isDesktop && { columnGap: responsive.columnGap },
        ]}
      >
        {visible.map((scored) => (
          <View key={scored.recipe.id} style={responsive.isDesktop && styles.desktopCard}>
            <RecipeCard scored={scored} onPress={onSelectRecipe} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  cards: { gap: space.sm },
  desktopCards: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  desktopCard: { width: '48%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: 44,
  },
  title: { letterSpacing: 0.5 },
});
