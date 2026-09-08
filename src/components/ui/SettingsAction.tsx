import { useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/Icon';
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
 * Keep this icon-only so the secondary action stays compact and consistent.
 */
export function SettingsAction({
  onPress,
  accessibilityHint = 'Opens app settings for theme, kitchen, and dietary preferences',
  style,
}: SettingsActionProps) {
  const { color } = useTheme();
  const [hovered, setHovered] = useState(false);
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
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      testID="settings-action"
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: pressed || hovered || focused ? color.surfaceAlt : 'transparent',
          borderColor: pressed || hovered || focused ? color.accent : color.border,
          opacity: pressed ? 0.86 : 1,
        },
        style,
      ]}
    >
      <Icon name="cog" size={22} color={color.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    minHeight: touchTarget.standard,
    minWidth: touchTarget.standard,
    width: touchTarget.standard,
    height: touchTarget.standard,
    paddingHorizontal: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});
