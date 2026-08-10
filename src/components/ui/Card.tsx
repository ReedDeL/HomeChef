import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface CardProps extends PropsWithChildren {
  /** `alt` insets a block inside an existing card without nesting elevation. */
  variant?: 'surface' | 'alt';
  style?: ViewStyle;
}

/**
 * A surface. Elevation comes from the token set, which is flat in dark mode
 * because a shadow on a near-black background reads as mud (spec §1.3).
 */
export function Card({ children, variant = 'surface', style }: CardProps) {
  const { color, shadow } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: variant === 'alt' ? color.surfaceAlt : color.surface,
          borderColor: color.border,
        },
        shadow.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
