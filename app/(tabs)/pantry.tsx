import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { IngredientChip } from '@/components/ui/IngredientChip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { getResponsiveLayout } from '@/components/ui/responsive-layout';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { lookupIngredient } from '@/data/catalog';
import {
  DEFAULT_SUGGESTION_COUNT,
  MAX_SEARCH_RESULTS,
  getReplenishingSuggestions,
  searchIngredientSuggestions,
} from '@/lib/ingredients/suggestions';
import { useKitchenStore } from '@/store/kitchen';
import { radius, space, touchTarget } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Spec §8 — view, add, correct.
 *
 * This screen exists because of risk R3: the pantry drifts out of date the
 * moment it is created, and a pantry the user cannot cheaply correct produces
 * recommendations they learn to ignore. So correction is the primary action
 * here, not a settings-menu afterthought — tap to remove, search to add.
 */
export default function PantryScreen() {
  const router = useRouter();
  const { color, shadow } = useTheme();
  const { width } = useWindowDimensions();
  const responsive = getResponsiveLayout(Platform.OS === 'web' ? width : 0);
  const pantry = useKitchenStore((state) => state.pantry);
  const togglePantryItem = useKitchenStore((state) => state.togglePantryItem);
  const removePantryItem = useKitchenStore((state) => state.removePantryItem);

  const [query, setQuery] = useState('');

  const suggestions = useMemo(() => {
    const term = query.trim();
    if (term.length === 0) {
      return getReplenishingSuggestions(pantry, DEFAULT_SUGGESTION_COUNT);
    }
    return searchIngredientSuggestions(term, pantry, MAX_SEARCH_RESULTS);
  }, [query, pantry]);

  const handleAddIngredient = useCallback(
    (id: string) => {
      togglePantryItem(id);
      const item = lookupIngredient(id);
      const name = item?.displayName ?? id;
      if (typeof AccessibilityInfo?.announceForAccessibility === 'function') {
        AccessibilityInfo.announceForAccessibility(`Added ${name} to pantry.`);
      }
    },
    [togglePantryItem]
  );

  const handleRemoveIngredient = useCallback(
    (id: string) => {
      removePantryItem(id);
      const item = lookupIngredient(id);
      const name = item?.displayName ?? id;
      if (typeof AccessibilityInfo?.announceForAccessibility === 'function') {
        AccessibilityInfo.announceForAccessibility(`Removed ${name} from pantry.`);
      }
    },
    [removePantryItem]
  );

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.intro}>
          <Text variant="display">Your pantry</Text>
          <Text variant="body" tone="muted">
            {pantry.length} {pantry.length === 1 ? 'ingredient' : 'ingredients'}. Tap anything you
            don&apos;t have.
          </Text>
        </View>

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

      <View
        style={[
          styles.pantryLayout,
          responsive.isDesktop && styles.desktopPantryLayout,
          responsive.isDesktop && { columnGap: responsive.columnGap },
        ]}
      >
        <View
          style={[
            styles.inventoryPanel,
            responsive.isDesktop && styles.desktopPanel,
            responsive.isDesktop && { backgroundColor: color.surface, borderColor: color.border },
            responsive.isDesktop && shadow.sm,
          ]}
        >
          <PrimaryButton
            label="Scan with a photo"
            onPress={() => router.push('/scan')}
            accessibilityHint="Photograph your kitchen to add ingredients"
          />

          <View style={styles.chipRow}>
            {pantry.map((id) => (
              <IngredientChip
                key={id}
                id={id}
                inPantry
                onToggle={handleRemoveIngredient}
                onRemove={handleRemoveIngredient}
              />
            ))}
          </View>
        </View>

        <View
          style={[
            styles.group,
            responsive.isDesktop && styles.desktopPanel,
            responsive.isDesktop && {
              backgroundColor: color.surfaceAlt,
              borderColor: color.border,
            },
            responsive.isDesktop && shadow.sm,
          ]}
        >
          <Text variant="heading">Add something</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search ingredients"
            placeholderTextColor={color.textMuted}
            accessibilityLabel="Search ingredients to add"
            accessibilityHint="Filters the list below"
            autoCorrect={false}
            style={[
              styles.input,
              { borderColor: color.border, backgroundColor: color.surface, color: color.text },
            ]}
          />

          <View style={styles.chipRow} accessibilityLiveRegion="polite">
            {suggestions.map((id) => (
              <IngredientChip key={id} id={id} onToggle={handleAddIngredient} />
            ))}
          </View>

          {suggestions.length === 0 ? (
            <Text variant="caption" tone="muted">
              {query.trim().length > 0
                ? `Nothing matching “${query.trim()}” in our ingredient list yet.`
                : 'You\u2019ve added all suggested ingredients! Use search above to find more.'}
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  intro: { gap: space.sm, flex: 1 },
  settingsButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: space.xs,
  },
  group: { gap: space.sm },
  pantryLayout: { gap: space.lg },
  inventoryPanel: { gap: space.lg },
  desktopPantryLayout: { flexDirection: 'row', alignItems: 'flex-start' },
  desktopPanel: {
    flex: 1,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  input: {
    minHeight: touchTarget.standard,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    fontSize: 17,
  },
});
