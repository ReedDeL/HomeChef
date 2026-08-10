import { type ColorSchemeName, useColorScheme } from 'react-native';

import { useKitchenStore, type ThemeMode } from '@/store/kitchen';
import { palette, shadow, type ElevationSet, type Palette } from '@/theme/tokens';

export type Theme = Palette;
export type Shadow = ElevationSet;

export interface ThemeContext {
  color: Theme;
  shadow: Shadow;
  isDark: boolean;
  themeMode: ThemeMode;
}

/**
 * Pure theme resolution based on user setting and OS color scheme.
 */
export function resolveTheme(
  themeMode: ThemeMode,
  systemScheme?: ColorSchemeName | null
): ThemeContext {
  const isDark =
    themeMode === 'dark' ? true : themeMode === 'light' ? false : systemScheme === 'dark';

  return {
    color: isDark ? palette.dark : palette.light,
    shadow: isDark ? shadow.dark : shadow.light,
    isDark,
    themeMode,
  };
}

/**
 * Resolves the active color scheme once, taking into account user preference
 * in settings ('light' | 'dark' | 'system') and falling back to OS appearance.
 *
 * `useColorScheme` returns null before the OS reports a preference; light is
 * the correct default because the app background is a warm white.
 */
export function useTheme(): ThemeContext {
  const systemScheme = useColorScheme();
  const themeMode = useKitchenStore((state) => state.themeMode);

  return resolveTheme(themeMode, systemScheme);
}
