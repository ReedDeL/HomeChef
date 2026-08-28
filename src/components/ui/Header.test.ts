import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-router', () => ({
  useRouter: () => ({
    back: vi.fn(),
    canGoBack: () => true,
    replace: vi.fn(),
    push: vi.fn(),
  }),
}));

import { Header, HeaderBackButton } from '@/components/ui/Header';

describe('Header', () => {
  it('renders back button with default label and accessibility label', () => {
    const markup = renderToStaticMarkup(
      createElement(Header, {
        backLabel: 'Back',
        fallbackHref: '/',
      })
    );

    expect(markup).toContain('aria-label="Back"');
    expect(markup).toContain('‹ Back');
  });

  it('renders custom back label and contextual accessibility label', () => {
    const markup = renderToStaticMarkup(
      createElement(Header, {
        backLabel: 'Kitchen',
        fallbackHref: '/(onboarding)/equipment',
      })
    );

    expect(markup).toContain('aria-label="Back to Kitchen"');
    expect(markup).toContain('‹ Kitchen');
  });

  it('supports explicit back accessibility label override', () => {
    const markup = renderToStaticMarkup(
      createElement(Header, {
        backLabel: 'Back',
        backAccessibilityLabel: 'Return to previous screen',
        fallbackHref: '/',
      })
    );

    expect(markup).toContain('aria-label="Return to previous screen"');
  });
});

describe('HeaderBackButton', () => {
  it('defaults accessibility label to "Back" when label is "Back"', () => {
    const markup = renderToStaticMarkup(
      createElement(HeaderBackButton, {
        label: 'Back',
        fallbackHref: '/',
      })
    );

    expect(markup).toContain('aria-label="Back"');
  });

  it('sets accessibility label to "Back to <label>" when label is not "Back"', () => {
    const markup = renderToStaticMarkup(
      createElement(HeaderBackButton, {
        label: 'Results',
        fallbackHref: '/',
      })
    );

    expect(markup).toContain('aria-label="Back to Results"');
  });
});
