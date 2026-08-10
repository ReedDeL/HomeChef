import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { layout, palette } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Letterboxes the app into a phone-width column on the web, and does nothing
 * at all on native.
 *
 * HomeChef is designed for one hand at 6pm (docs/04_UIUX_SPEC.md §0). Letting
 * that layout stretch to a 1920px monitor does not make it a desktop app, it
 * just makes it a broken phone app — 600pt-wide summary tiles and a single
 * sparse row of ingredient chips. Constraining the width keeps the browser
 * showing the same thing the device shows, which is also what makes the web
 * build usable for reviewing native work.
 *
 * The hairline side borders only appear once the viewport is wider than the
 * column, so on a phone browser they sit off-screen and cost nothing.
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
        Platform.OS === 'web' && { borderColor: color.border, ...styles.webFrame },
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
    /**
     * The parent is React Native's root view, which is a column flex container
     * — so the cross axis is horizontal and this is what centres the column on
     * a wide viewport. Doing it here rather than in the HTML shell keeps the
     * behaviour identical whether the web build is exported as an SPA or as
     * static HTML.
     */
    alignSelf: 'center',
  },
  webFrame: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
});
