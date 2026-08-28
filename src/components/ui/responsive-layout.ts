import { layout, space } from '@/theme/tokens';

export type ResponsiveMode = 'mobile' | 'tablet' | 'desktop';

export interface ResponsiveLayout {
  mode: ResponsiveMode;
  isDesktop: boolean;
  /** Desktop has room to show every cuisine choice; phones keep a thumb-friendly rail. */
  cuisineFilter: 'wrap' | 'scroll';
  horizontalPadding: number;
  contentMaxWidth: number | undefined;
  columnGap: number;
  gridColumns: 1 | 2;
}

/**
 * Maps a viewport width to the layout values shared by the web shell and
 * screen-level compositions. Keeping this pure makes the breakpoint contract
 * testable without a browser or React Native renderer.
 */
export function getResponsiveLayout(width: number): ResponsiveLayout {
  const viewportWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const isDesktop = viewportWidth >= layout.desktopBreakpoint;
  const isTablet = viewportWidth >= layout.tabletBreakpoint;

  return {
    mode: isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile',
    isDesktop,
    cuisineFilter: isDesktop ? 'wrap' : 'scroll',
    horizontalPadding: isDesktop ? layout.desktopGutter : isTablet ? space.lg : space.md,
    contentMaxWidth: isDesktop ? layout.desktopMaxWidth : undefined,
    columnGap: isDesktop ? layout.desktopColumnGap : space.md,
    gridColumns: isDesktop ? 2 : 1,
  };
}
