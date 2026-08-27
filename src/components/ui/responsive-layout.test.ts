import { describe, expect, it } from 'vitest';

import { getResponsiveLayout } from './responsive-layout';

describe('getResponsiveLayout', () => {
  it('keeps phone widths single-column and edge-to-edge', () => {
    expect(getResponsiveLayout(390)).toMatchObject({
      mode: 'mobile',
      isDesktop: false,
      gridColumns: 1,
    });
  });

  it('uses a fluid tablet layout without enabling desktop composition', () => {
    expect(getResponsiveLayout(760)).toMatchObject({
      mode: 'tablet',
      isDesktop: false,
      gridColumns: 1,
    });
  });

  it('uses a centered multi-column workspace on desktop', () => {
    expect(getResponsiveLayout(1280)).toMatchObject({
      mode: 'desktop',
      isDesktop: true,
      contentMaxWidth: 1180,
      gridColumns: 2,
    });
  });

});
