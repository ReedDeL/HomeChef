import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RecipeImage } from '@/components/ui/RecipeImage';

describe('RecipeImage', () => {
  it('keeps supplied photos above bundled artwork', () => {
    const markup = renderToStaticMarkup(
      createElement(RecipeImage, {
        uri: 'https://example.test/food.jpg',
        recipeId: 'hc-mw-01',
        title: 'Mug Scrambled Eggs',
      })
    );
    expect(markup).toContain('aria-label="Mug Scrambled Eggs"');
    expect(markup).toContain('Serving illustration for Mug Scrambled Eggs');
    expect(markup).toContain('width:72px;height:72px');
  });

  it('renders the registered food tile rather than a cutlery glyph when a URL is missing', () => {
    const markup = renderToStaticMarkup(
      createElement(RecipeImage, {
        recipeId: 'hc-mw-01',
        uri: null,
        title: 'Mug Scrambled Eggs',
      })
    );
    expect(markup).toContain('left:-72px;top:-72px');
    expect(markup).toContain('Serving illustration');
    expect(markup).not.toContain('data-icon');
  });

  it('uses a neutral place setting for unknown recipes', () => {
    const markup = renderToStaticMarkup(createElement(RecipeImage, { title: 'New dish' }));
    expect(markup).toContain('left:-288px;top:-504px');
    expect(markup).not.toContain('data-icon');
  });

  it('does not attempt to render a blank remote URL', () => {
    const markup = renderToStaticMarkup(
      createElement(RecipeImage, { uri: '  ', title: 'New dish' })
    );
    expect(markup.match(/aria-label=/g)).toHaveLength(1);
  });
});
