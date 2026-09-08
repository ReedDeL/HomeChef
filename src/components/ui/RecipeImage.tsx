import { useState } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';

import servingArt from '../../../assets/meal-art/servings.png';
import { MEAL_ART_COLUMNS, MEAL_ART_ROWS, mealArtTile } from '@/data/meal-art';
import { radius } from '@/theme/tokens';

export interface RecipeImageProps {
  uri?: string | null;
  recipeId?: string;
  title: string;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

/** Approved photos take precedence; bundled serving illustrations work offline. */
export function RecipeImage({ uri, recipeId, title, size = 72, style }: RecipeImageProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [frame, setFrame] = useState({ width: size, height: size });
  const tile = mealArtTile(recipeId);
  const tileSize = Math.max(frame.width, frame.height);
  const photoUri = uri?.trim();
  const showPhoto = Boolean(photoUri && failedUri !== photoUri);

  return (
    <View
      testID="recipe-image"
      accessible={false}
      onLayout={({ nativeEvent: { layout } }) => {
        if (layout.width > 0 && layout.height > 0) {
          setFrame((current) =>
            current.width === layout.width && current.height === layout.height
              ? current
              : { width: layout.width, height: layout.height }
          );
        }
      }}
      style={[styles.thumbnail, { width: size, height: size }, style]}
    >
      <Image
        source={typeof servingArt === 'string' ? { uri: servingArt } : servingArt}
        resizeMode="stretch"
        accessibilityLabel={`Serving illustration for ${title}`}
        accessibilityHint="Illustrative serving only; follow the recipe ingredients"
        accessible={false}
        accessibilityIgnoresInvertColors
        style={{
          position: 'absolute',
          width: tileSize * MEAL_ART_COLUMNS,
          height: tileSize * MEAL_ART_ROWS,
          left: -(tile % MEAL_ART_COLUMNS) * tileSize + (frame.width - tileSize) / 2,
          top: -Math.floor(tile / MEAL_ART_COLUMNS) * tileSize + (frame.height - tileSize) / 2,
        }}
      />
      {showPhoto ? (
        <Image
          source={{ uri: photoUri! }}
          onError={() => setFailedUri(photoUri!)}
          accessibilityLabel={title}
          accessibilityHint={`Photo of ${title}`}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: { borderRadius: radius.md, overflow: 'hidden' },
});
