import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, space, touchTarget } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  accessibilityHint: string;
  disabled?: boolean;
  /** Secondary actions ("I'll add them manually") share the size, not the fill. */
  variant?: 'primary' | 'ghost';
}

/**
 * The primary call to action: full width, 56pt tall (spec §1.4).
 *
 * Full width is not decoration — it is the largest possible target for a tired
 * user holding the phone in one hand, which is the whole design premise.
 */
export function PrimaryButton({
  label,
  onPress,
  accessibilityHint,
  disabled = false,
  variant = 'primary',
}: PrimaryButtonProps) {
  const { color } = useTheme();
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isGhost ? 'transparent' : color.accent,
          borderColor: isGhost ? color.border : color.accent,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text variant="bodyStrong" tone={isGhost ? 'default' : 'onAccent'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: touchTarget.primaryCtaHeight,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
