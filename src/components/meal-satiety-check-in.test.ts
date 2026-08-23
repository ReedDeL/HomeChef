import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MealSatietyCheckIn } from '@/components/ui/MealSatietyCheckIn';

describe('MealSatietyCheckIn', () => {
  it('marks every interaction disabled while a save is pending', () => {
    const markup = renderToStaticMarkup(
      createElement(MealSatietyCheckIn, {
        recipeTitle: 'Test meal',
        isSaving: true,
        errorMessage: null,
        onBack: () => undefined,
        onSave: () => undefined,
        onSkip: () => undefined,
      })
    );

    expect(markup).toContain('aria-label="← Back to verdict"');
    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(6);
    expect(markup.match(/tabindex="-1"/g)).toHaveLength(6);
  });
});
