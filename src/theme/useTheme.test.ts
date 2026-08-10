import { describe, expect, it } from 'vitest';

import { palette, shadow } from '@/theme/tokens';
import { resolveTheme } from '@/theme/useTheme';

describe('resolveTheme', () => {
  it('returns light palette and false isDark when themeMode is light', () => {
    const theme = resolveTheme('light', 'dark'); // even if system is dark, user chose light

    expect(theme.isDark).toBe(false);
    expect(theme.themeMode).toBe('light');
    expect(theme.color).toEqual(palette.light);
    expect(theme.shadow).toEqual(shadow.light);
  });

  it('returns dark palette and true isDark when themeMode is dark', () => {
    const theme = resolveTheme('dark', 'light'); // even if system is light, user chose dark

    expect(theme.isDark).toBe(true);
    expect(theme.themeMode).toBe('dark');
    expect(theme.color).toEqual(palette.dark);
    expect(theme.shadow).toEqual(shadow.dark);
  });

  it('follows system scheme when themeMode is system', () => {
    // System reports dark
    const darkTheme = resolveTheme('system', 'dark');
    expect(darkTheme.isDark).toBe(true);
    expect(darkTheme.color).toEqual(palette.dark);

    // System reports light
    const lightTheme = resolveTheme('system', 'light');
    expect(lightTheme.isDark).toBe(false);
    expect(lightTheme.color).toEqual(palette.light);

    // System reports null (defaults to light)
    const defaultTheme = resolveTheme('system', null);
    expect(defaultTheme.isDark).toBe(false);
    expect(defaultTheme.color).toEqual(palette.light);
  });
});
