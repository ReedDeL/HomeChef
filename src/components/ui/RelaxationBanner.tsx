import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { Relaxation } from '@/engine/types';
import { formatRelaxation } from '@/lib/format';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface RelaxationBannerProps {
  relaxations: readonly Relaxation[];
  /** The undo. Always offered, per spec §5.3. */
  onRevert?: () => void;
  revertLabel?: string;
}

/**
 * States, above the results, which soft constraint the app gave up (spec §5.3).
 *
 * Relaxation is never silent. An app that quietly widens the filter and shows
 * results the user did not ask for is teaching them not to trust the filter,
 * and the filter is the entire product. Undo is always offered alongside.
 *
 * `tier2_escalation` is filtered out deliberately: it adds options without
 * removing constraints, so there is nothing to disclose.
 */
export function RelaxationBanner({
  relaxations,
  onRevert,
  revertLabel = 'Undo',
}: RelaxationBannerProps) {
  const { color } = useTheme();

  const disclosed = relaxations.filter((relaxation) => relaxation.kind !== 'tier2_escalation');
  if (disclosed.length === 0) return null;

  return (
    <View
      style={[styles.banner, { backgroundColor: color.surfaceAlt, borderColor: color.accent }]}
      accessible
      accessibilityRole="alert"
    >
      <View style={styles.copy}>
        {disclosed.map((relaxation, index) => (
          <Text key={`${relaxation.kind}-${index}`} variant="body">
            {formatRelaxation(relaxation)}
          </Text>
        ))}
      </View>

      {onRevert ? (
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={revertLabel}
          accessibilityHint="Restores the constraint the app relaxed"
          onPress={onRevert}
          style={({ pressed }) => [
            styles.revert,
            { borderColor: color.accent, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text variant="caption" tone="accent" style={styles.revertLabel}>
            {revertLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  copy: { gap: space.xs },
  revert: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  revertLabel: { fontWeight: '600' },
});
