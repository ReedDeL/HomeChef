import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type TabIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

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
    icon: 'silverware-fork-knife',
    activeIcon: 'silverware-fork-knife',
  },
  {
    name: 'plan',
    title: 'Plan',
    accessibilityLabel: 'Plan, plan your week',
    icon: 'calendar-month-outline',
    activeIcon: 'calendar-month',
  },
  {
    name: 'pantry',
    title: 'Pantry',
    accessibilityLabel: 'Pantry, what you have',
    icon: 'fridge-outline',
    activeIcon: 'fridge',
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
