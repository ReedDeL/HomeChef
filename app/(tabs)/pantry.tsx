import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
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
import { INGREDIENT_VOCABULARY } from '@/data/catalog';
import { COMMON_PANTRY_IDS, useKitchenStore } from '@/store/kitchen';
import { radius, space, touchTarget } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Enough to choose from, few enough to scan. */
const MAX_SEARCH_RESULTS = 24;

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
  const responsive = getResponsiveLayout(Platform.OS === 'web' ? width : 0, false);
  const pantry = useKitchenStore((state) => state.pantry);
  const togglePantryItem = useKitchenStore((state) => state.togglePantryItem);
  const removePantryItem = useKitchenStore((state) => state.removePantryItem);

  const [query, setQuery] = useState('');

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    const owned = new Set(pantry);

    if (term.length === 0) {
      return COMMON_PANTRY_IDS.filter((id) => !owned.has(id));
    }

    return INGREDIENT_VOCABULARY.filter(
      (entry) => !owned.has(entry.id) && entry.displayName.toLowerCase().includes(term)
    )
      .slice(0, MAX_SEARCH_RESULTS)
      .map((entry) => entry.id);
  }, [query, pantry]);

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
                onToggle={removePantryItem}
                onRemove={removePantryItem}
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

          <View style={styles.chipRow}>
            {suggestions.map((id) => (
              <IngredientChip key={id} id={id} onToggle={togglePantryItem} />
            ))}
          </View>

          {query.trim().length > 0 && suggestions.length === 0 ? (
            <Text variant="caption" tone="muted">
              Nothing matching &ldquo;{query.trim()}&rdquo; in our ingredient list yet.
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
