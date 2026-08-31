import { Redirect, useLocalSearchParams } from 'expo-router';

import { legacyCookRedirectHref } from '@/lib/navigation';

/**
 * Compatibility route for saved links from the retired cook-mode experience.
 * Recipe instructions now live on the recipe screen itself.
 */
export default function LegacyCookRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();

  return <Redirect href={legacyCookRedirectHref(id)} />;
}
