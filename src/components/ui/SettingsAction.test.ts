import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    color: {
      bg: '#FFF8EF',
      surface: '#FFFFFF',
      surfaceAlt: '#F6EBDD',
      text: '#251B16',
      textMuted: '#706158',
      accent: '#C04E31',
      accentText: '#FFFFFF',
      ready: '#34745A',
      near: '#A45F0A',
      far: '#81736A',
      danger: '#B93832',
      border: '#E8D6C5',
    },
    shadow: {},
    isDark: false,
    themeMode: 'light',
  }),
}));

import { SettingsAction } from '@/components/ui/SettingsAction';

describe('SettingsAction', () => {
  it('renders the shared text-only Settings action with an accessible name', () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsAction, {
        onPress: () => undefined,
      })
    );

    expect(markup).toContain('Settings');
    expect(markup).toContain('aria-label="Settings"');
    expect(markup).not.toContain('⚙️');
  });

  it('supports a contextual hint while retaining the shared accessible name', () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsAction, {
        onPress: () => undefined,
        accessibilityHint: 'Opens settings for reminder preferences',
      })
    );

    expect(markup).toContain('aria-label="Settings"');
    expect(markup).toContain('Settings');
  });
});
