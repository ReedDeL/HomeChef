import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/Icon', () => ({
  Icon: ({ name }: { name: string }) => createElement('span', { 'data-icon': name }),
}));

import { RecipeImage } from '@/components/ui/RecipeImage';

describe('RecipeImage', () => {
  it('renders image when uri is provided', () => {
    const markup = renderToStaticMarkup(
      createElement(RecipeImage, {
        uri: 'https://example.test/food.jpg',
        title: 'Garlic Butter Pasta',
      })
    );

    expect(markup).not.toContain('>G<');
    expect(markup).toContain('style="width:72px;height:72px"');
  });

  it('renders a stable food placeholder when uri is null', () => {
    const markup = renderToStaticMarkup(
      createElement(RecipeImage, {
        uri: null,
        title: 'Garlic Butter Pasta',
      })
    );

    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('>G<');
    expect(markup).toContain('data-icon="meal"');
  });

  it('renders fallback icon when title is empty', () => {
    const markup = renderToStaticMarkup(
      createElement(RecipeImage, {
        uri: null,
        title: '',
      })
    );

    expect(markup).not.toContain('🍽️');
    expect(markup).toContain('data-icon="meal"');
  });
});
