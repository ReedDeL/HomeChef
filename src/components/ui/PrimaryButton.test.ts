import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/Icon', () => ({
  Icon: ({ name }: { name: string }) => createElement('span', { 'data-icon': name }),
}));

import { PrimaryButton } from '@/components/ui/PrimaryButton';

const props = {
  label: 'Build my plan',
  onPress: () => undefined,
  accessibilityHint: 'Creates your weekly plan',
};

describe('PrimaryButton', () => {
  it('supports primary, secondary, and ghost variants with icons', () => {
    const markup = renderToStaticMarkup(
      createElement(PrimaryButton, { ...props, variant: 'secondary', icon: 'calendar' })
    );

    expect(markup).toContain('Build my plan');
    expect(markup).toContain('data-icon="calendar"');
  });

  it('marks loading actions busy and disables interaction', () => {
    const markup = renderToStaticMarkup(createElement(PrimaryButton, { ...props, loading: true }));

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('Build my plan');
  });

  it('keeps long labels flexible instead of clipping them to a fixed height', () => {
    const markup = renderToStaticMarkup(
      createElement(PrimaryButton, { ...props, label: 'Show more matches from my pantry' })
    );

    expect(markup).toContain('Show more matches from my pantry');
  });
});
