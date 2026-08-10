/**
 * CORS for the Edge Functions.
 *
 * The web build calls these from a browser, so a preflight that fails is
 * indistinguishable to the user from the feature being broken. The headers go
 * on *every* response including errors — an error response without them
 * surfaces in the browser as an opaque CORS failure, which hides the actual
 * status code and message and makes the bug much harder to find than it needs
 * to be.
 */

export const corsHeaders: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Handle the preflight before anything else, including auth or body parsing. */
export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: corsHeaders });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}
