import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface ScreenProps extends PropsWithChildren {
  /**
   * Pinned to the bottom, outside the scroll area. Onboarding's "Continue"
   * lives here so it never scrolls out of reach on a short phone.
   */
  footer?: ReactNode;
  /** Results manages its own scrolling per bucket; opt out here. */
  scroll?: boolean;
}

/**
 * The frame every screen sits in: safe-area insets, background, page padding,
 * and an optional pinned footer.
 *
 * Centralised so that a screen cannot accidentally ship without safe-area
 * handling — the failure mode is a title tucked under a notch, which is
 * invisible on a simulator with no notch and obvious on real hardware.
 */
export function Screen({ children, footer, scroll = true }: ScreenProps) {
  const { color } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: color.bg }]}
      edges={['top', 'bottom']}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex]}>{children}</View>
      )}

      {footer ? (
        <View style={[styles.footer, { borderTopColor: color.border, backgroundColor: color.bg }]}>
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: {
    padding: space.lg,
    gap: space.lg,
  },
  footer: {
    padding: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
