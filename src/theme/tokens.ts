/**
 * Design tokens — the single source of truth for color, type, and spacing.
 * Values transcribed from docs/04_UIUX_SPEC.md §1. Hardcoding a color or a
 * spacing number anywhere else is a review-blocking rule.
 */

export type ColorScheme = 'light' | 'dark';

/**
 * `danger` is reserved exclusively for allergen warnings — not validation
 * errors, not destructive buttons. If red always means "this could hurt you,"
 * red keeps meaning it.
 */
export const palette = {
  light: {
    bg: '#FFFCF8',
    surface: '#FFFFFF',
    surfaceAlt: '#F5F0E8',
    text: '#1A1613',
    textMuted: '#6B6259',
    accent: '#D94F14',
    accentText: '#FFFFFF',
    ready: '#2E7D4F',
    near: '#C77D12',
    far: '#8A8079',
    danger: '#C62828',
    border: '#E5DDD2',
  },
  dark: {
    bg: '#151312',
    surface: '#221F1D',
    surfaceAlt: '#2C2825',
    text: '#F5F0E8',
    textMuted: '#A69C91',
    accent: '#FF7A3D',
    accentText: '#151312',
    ready: '#4CAF7D',
    near: '#E8A33D',
    far: '#9C938B',
    danger: '#FF6B6B',
    border: '#38332F',
  },
} as const;

export type ColorToken = keyof (typeof palette)['light'];

/** System font stack only — a custom font costs bundle size and a layout shift. */
export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 19, fontWeight: '400' },
  /** Cook mode only — readable from arm's length across a counter. */
  cookStep: { fontSize: 28, lineHeight: 38, fontWeight: '500' },
} as const;

/** 4pt base scale. */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 20, full: 999 } as const;

/**
 * Minimum touch targets in pt. Cook mode is oversized deliberately — it is
 * operated with a knuckle or the back of a hand.
 */
export const touchTarget = { standard: 44, cookMode: 64, primaryCtaHeight: 56 } as const;
