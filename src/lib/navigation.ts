import type { IconName } from '@/components/ui/Icon.types';

export type TabIconName = IconName;

export interface PrimaryTabItem {
  readonly name: 'index' | 'plan' | 'pantry';
  readonly title: string;
  readonly accessibilityLabel: string;
  readonly icon: TabIconName;
  readonly activeIcon: TabIconName;
}

export const PRIMARY_TABS: readonly PrimaryTabItem[] = [
  {
    name: 'index',
    title: 'Now',
    accessibilityLabel: 'Now, decide what to make',
    icon: 'meal',
    activeIcon: 'meal',
  },
  {
    name: 'plan',
    title: 'Plan',
    accessibilityLabel: 'Plan, plan your week',
    icon: 'calendar',
    activeIcon: 'calendar',
  },
  {
    name: 'pantry',
    title: 'Pantry',
    accessibilityLabel: 'Pantry, what you have',
    icon: 'pantry',
    activeIcon: 'pantry',
  },
] as const;

type LegacyCookRouteParam = string | string[] | undefined;

export type LegacyCookRedirectHref =
  | '/'
  | {
      pathname: '/recipe/[id]';
      params: { id: string };
    };

export function legacyCookRedirectHref(id: LegacyCookRouteParam): LegacyCookRedirectHref {
  const recipeId = (Array.isArray(id) ? id[0] : id)?.trim();

  return recipeId ? { pathname: '/recipe/[id]', params: { id: recipeId } } : '/';
}
