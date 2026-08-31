export const PRIMARY_TABS = [
  {
    name: 'index',
    title: 'Now',
    accessibilityLabel: 'Now, decide what to make',
  },
  {
    name: 'plan',
    title: 'Plan',
    accessibilityLabel: 'Plan, plan your week',
  },
  {
    name: 'pantry',
    title: 'Pantry',
    accessibilityLabel: 'Pantry, what you have',
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
