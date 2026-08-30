import { useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, space, touchTarget } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface SettingsActionProps {
  onPress: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The single secondary Settings action used throughout the app.
 *
 * Keep this text-only instead of relying on a platform-specific emoji glyph:
 * it stays aligned and readable across native, web, themes, and larger text.
 */
export function SettingsAction({
  onPress,
  accessibilityHint = 'Opens app settings for theme, kitchen, and dietary preferences',
  style,
}: SettingsActionProps) {
  const { color } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel="Settings"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: pressed || focused ? color.surfaceAlt : 'transparent',
          borderColor: pressed || focused ? color.accent : color.border,
          opacity: pressed ? 0.86 : 1,
        },
        style,
      ]}
    >
      <Text variant="caption" tone="accent">
        Settings
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    minHeight: touchTarget.standard,
    minWidth: touchTarget.standard,
    paddingHorizontal: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});
