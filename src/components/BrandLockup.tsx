import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import homeChefMark from '../../assets/brand/homechef-mark.png';

import { Text } from '@/components/ui/Text';
import { space } from '@/theme/tokens';

interface BrandLockupProps {
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The shared brand lockup. The image is decorative because the wordmark names the app. */
export function BrandLockup({ compact = false, style }: BrandLockupProps) {
  return (
    <View style={[styles.lockup, style]}>
      <Image
        accessible={false}
        source={homeChefMark}
        resizeMode="contain"
        style={compact ? styles.compactMark : styles.mark}
      />
      <Text
        accessibilityRole="header"
        variant={compact ? 'heading' : 'title'}
        style={styles.wordmark}
      >
        HomeChef
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
  },
  mark: {
    width: 52,
    height: 52,
  },
  compactMark: {
    width: 36,
    height: 36,
  },
  wordmark: {
    letterSpacing: -0.6,
  },
});
