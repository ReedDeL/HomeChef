import { describe, expect, it } from 'vitest';

import { getResponsiveLayout } from './responsive-layout';

describe('getResponsiveLayout', () => {
  it('keeps phone widths single-column and edge-to-edge', () => {
    expect(getResponsiveLayout(390)).toMatchObject({
      mode: 'mobile',
      isDesktop: false,
      cuisineFilter: 'scroll',
      gridColumns: 1,
    });
  });

  it('uses a fluid tablet layout without enabling desktop composition', () => {
    expect(getResponsiveLayout(760)).toMatchObject({
      mode: 'tablet',
      isDesktop: false,
      cuisineFilter: 'scroll',
      gridColumns: 1,
    });
  });

  it.each([960, 1180, 1920])('wraps the cuisine filter at desktop width (%i px)', (width) => {
    expect(getResponsiveLayout(width)).toMatchObject({
      mode: 'desktop',
      isDesktop: true,
      cuisineFilter: 'wrap',
      contentMaxWidth: 1600,
      gridColumns: 2,
    });
  });
});
