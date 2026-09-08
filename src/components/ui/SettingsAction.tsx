import type { StyleProp, ViewStyle } from 'react-native';

import { ActionButton } from '@/components/ui/ActionButton';

export interface SettingsActionProps {
  onPress: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** Labeled secondary action so Settings remains recognizable without a glyph. */
export function SettingsAction({
  onPress,
  accessibilityHint = 'Opens app settings for theme, kitchen, and dietary preferences',
  style,
}: SettingsActionProps) {
  return (
    <ActionButton
      label="Settings"
      icon="cog"
      onPress={onPress}
      accessibilityHint={accessibilityHint}
      style={style}
      testID="settings-action"
    />
  );
}
