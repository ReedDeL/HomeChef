import { useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { radius, space, touchTarget } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface ActionButtonProps {
  label: string;
  icon: IconName;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Compact secondary action with a visible label, never an unexplained glyph. */
export function ActionButton({
  label,
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ActionButtonProps) {
  const { color } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed || hovered || focused ? color.surfaceAlt : color.surface,
          borderColor: focused ? color.accent : color.border,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={20} color={color.accent} />
      <Text variant="caption" tone="accent" style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget.standard,
    minWidth: touchTarget.standard,
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 2,
    borderRadius: radius.full,
  },
  label: { flexShrink: 1, fontWeight: '600' },
});
