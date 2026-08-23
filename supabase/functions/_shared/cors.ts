/**
 * CORS for the Edge Functions.
 *
 * The web build calls these from a browser, so a preflight that fails is
 * indistinguishable to the user from the feature being broken. The headers go
 * on *every* response including errors — an error response without them
 * surfaces in the browser as an opaque CORS failure, which hides the actual
 * status code and message and makes the bug much harder to find than it needs
 * to be.
 *
 * Origin policy: unset ALLOWED_ORIGINS keeps the historical open posture,
 * because CORS was never the access-control boundary — the functions reject
 * unauthenticated callers themselves. Setting ALLOWED_ORIGINS (comma-separated
 * exact origins) narrows which BROWSER may read responses; production should
 * set it once the deployed web origin is known. Native apps and curl send no
 * Origin header and are unaffected either way — browsers are the only clients
 * that enforce CORS at all.
 */

/** Exact origins a browser client may read responses from. */
function resolveOrigin(request: Request): string {
  const configured = Deno.env.get('ALLOWED_ORIGINS')?.trim();
  if (!configured || configured === '*') return '*';

  const allowed = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const primary = allowed[0];
  if (!primary) return '*';

  const origin = request.headers.get('Origin');
  if (!origin) return primary;

  // A disallowed origin still gets an ACAO header — one that does not match
  // it, which is what makes the browser refuse the response. Omitting the
  // header entirely would read as a misconfiguration instead of a denial.
  return allowed.includes(origin) ? origin : primary;
}

export function corsHeaders(request: Request): Readonly<Record<string, string>> {
  return {
    'Access-Control-Allow-Origin': resolveOrigin(request),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // Origins vary per request now; caches must not mix them up.
    Vary: 'Origin',
  };
}

/** Handle the preflight before anything else, including auth or body parsing. */
export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: corsHeaders(request) });
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), ...extraHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(
  request: Request,
  message: string,
  status: number,
  extraHeaders: Record<string, string> = {}
): Response {
  return jsonResponse(request, { error: message }, status, extraHeaders);
}
