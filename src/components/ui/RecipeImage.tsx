import { useState } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface RecipeImageProps {
  uri?: string | null;
  title: string;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * Shared image primitive with a stable food placeholder when `uri` is null or fails.
 */
export function RecipeImage({ uri, title, size = 72, style }: RecipeImageProps) {
  const { color } = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);

  if (!uri || failedUri === uri) {
    return (
      <View
        style={[
          styles.thumbnail,
          styles.placeholder,
          {
            width: size,
            height: size,
            borderColor: color.border,
            backgroundColor: color.surfaceAlt,
          },
          style,
        ]}
        accessible={false}
      >
        <Icon name="meal" size={Math.round(size * 0.45)} color={color.textMuted} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      onError={() => setFailedUri(uri)}
      accessibilityLabel={title}
      accessibilityHint={`Photo of ${title}`}
      style={[styles.thumbnail, { width: size, height: size }, style]}
      accessibilityIgnoresInvertColors
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    borderRadius: radius.md,
  },
  placeholder: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
