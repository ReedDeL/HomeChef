import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface SelectableCardProps {
  title: string;
  /** The subtitle does the explaining — the spec allows no help text or tooltip. */
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  accessibilityHint: string;
}

/** Spec §3.1: 72pt tall, accent border when selected. */
const CARD_HEIGHT = 72;

/**
 * A single-select row, used for the equipment tier in onboarding.
 *
 * Selection is shown with an accent border *and* a filled marker rather than
 * colour alone, so it survives a colour-blind user and a greyscale screenshot.
 */
export function SelectableCard({
  title,
  subtitle,
  selected,
  onPress,
  accessibilityHint,
}: SelectableCardProps) {
  const { color, shadow } = useTheme();

  return (
    <Pressable
      accessible
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: color.surface,
          borderColor: selected ? color.accent : color.border,
          borderWidth: selected ? 2 : 1,
          opacity: pressed ? 0.9 : 1,
        },
        shadow.sm,
      ]}
    >
      <View
        style={[
          styles.marker,
          { borderColor: selected ? color.accent : color.border },
          selected && { backgroundColor: color.accent },
        ]}
      />
      <View style={styles.copy}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  marker: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 2,
  },
  copy: { flex: 1, gap: 2 },
});
