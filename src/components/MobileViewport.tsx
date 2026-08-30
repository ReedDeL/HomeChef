import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { layout, palette } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Keeps native and phone-sized browser layouts compact while giving desktop
 * browsers a real responsive workspace.
 *
 * The web shell is capped at the desktop workspace width from the layout
 * tokens; screens add their own desktop composition inside it. A narrow browser
 * remains naturally phone-width, so the mobile experience does not change.
 */
export function MobileViewport({ children }: PropsWithChildren) {
  const { color, isDark } = useTheme();
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = isDark
        ? palette.dark.surfaceAlt
        : palette.light.surfaceAlt;
    }
  }, [isDark]);

  return (
    <View
      style={[
        styles.column,
        { backgroundColor: color.bg },
        Platform.OS === 'web' && styles.webCanvas,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    width: '100%',
    maxWidth: layout.mobileViewportMaxWidth,
    alignSelf: 'center',
  },
  webCanvas: {
    maxWidth: '100%',
  },
});
