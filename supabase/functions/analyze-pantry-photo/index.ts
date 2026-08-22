import { z } from 'https://esm.sh/zod@4.1.11';

import { errorResponse, jsonResponse, preflight } from '../_shared/cors.ts';

/**
 * Photo → pantry candidates, according to the photo-to-pantry contract.
 *
 * The function does vision and validation only. It deliberately does not write
 * to `inventory`: every detected item goes back to the client for confirmation
 * first, because the user has to be able to correct a misread before it
 * reaches the pantry. A wrong ingredient written silently is the capture-time
 * origin of the inventory drift (risk R3) that makes recommendations rot.
 *
 * Normalization to canonical ids happens on the client, against the same
 * bundled vocabulary the engine matches against. See NORMALIZATION below.
 */

/**
 * Stable pinned model for the photo-to-pantry Edge Function.
 *
 * NOT `gemini-flash-latest`: the alias hot-swaps on release with two weeks'
 * notice, which would let the prompt and schema start behaving differently
 * mid-launch. NOT `gemini-2.0-flash`, which is shut down.
 */
const MODEL = 'gemini-3.6-flash';

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** One fridge, one freezer, a couple of shelves. More is a client bug. */
const MAX_IMAGES = 10;

/**
 * Roughly 1.5 MB of base64 per image. The client resizes to 640×640 at ~0.7
 * JPEG quality used by the client, which lands two orders of magnitude below
 * this — the
 * cap exists to reject an uncompressed upload, not to trim a legitimate one.
 */
const MAX_IMAGE_CHARS = 2_000_000;

/**
 * The response contract for detected pantry items. Types are the uppercase
 * proto enum names the Gemini REST API actually accepts; protobuf's JSON enum
 * parsing rejects lowercase enum values.
 */
const INGREDIENT_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING', description: 'Generic ingredient type, never a brand' },
      quantity: { type: 'NUMBER' },
      unit: { type: 'STRING', enum: ['grams', 'milliliters', 'pieces', 'cups', 'unknown'] },
      confidence: { type: 'NUMBER', description: '0.0 to 1.0' },
    },
    required: ['name', 'quantity', 'unit', 'confidence'],
  },
} as const;

/**
 * Structured output is a strong guarantee, not a total one, and it says
 * nothing about whether the values are sane. Zod is the boundary check: it is
 * where a negative quantity or an out-of-range confidence stops.
 */
const DetectedItem = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().nonnegative().max(10_000),
  unit: z.enum(['grams', 'milliliters', 'pieces', 'cups', 'unknown']),
  confidence: z.number().min(0).max(1),
});

const DetectedItems = z.array(DetectedItem).max(100);

const RequestBody = z.object({
  images: z.array(z.string().min(1).max(MAX_IMAGE_CHARS)).min(1).max(MAX_IMAGES),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
});

const PROMPT = `You are cataloguing the contents of someone's kitchen from photographs.

List every distinct food ingredient you can actually see. Follow these rules exactly:

1. Name the generic ingredient TYPE, never a brand and never packaging text.
   Write "chicken breast", not "Tyson Chicken Breast 3lb". Write "milk", not
   "Horizon Organic Whole Milk".
2. Use the plain everyday name for the ingredient, with no size, colour, or
   preparation words unless they change what the ingredient is. Write "onion",
   not "large red onion". But "oat milk" and "milk" are different ingredients,
   so keep the word that distinguishes them.
3. One entry per ingredient type. If you see three onions, that is one entry
   with quantity 3 and unit "pieces".
4. Only list what is visibly identifiable. Do not infer that a kitchen probably
   contains salt. Do not guess at the contents of an opaque container.
5. confidence is your genuine certainty that this specific ingredient is
   present and correctly named, from 0.0 to 1.0. Be honest and calibrated:
   a partly hidden item behind other items is not 0.9. Anything you are
   guessing at belongs below 0.5.
6. Use unit "unknown" when the amount is not determinable, with quantity 1.

Return only the structured list.`;

Deno.serve(async (request: Request): Promise<Response> => {
  // Preflight first, before auth, parsing, or anything that can throw.
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    // Loud in the logs, vague to the caller: the client must never learn
    // whether a key exists, and the operator needs to know immediately.
    console.error('GEMINI_API_KEY is not configured for this project.');
    return errorResponse('Photo recognition is unavailable.', 503);
  }

  let payload: z.infer<typeof RequestBody>;
  try {
    payload = RequestBody.parse(await request.json());
  } catch (error) {
    console.warn('Rejected malformed request', error);
    return errorResponse('Send 1 to 10 base64-encoded images.', 400);
  }

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: PROMPT },
              ...payload.images.map((data) => ({
                inline_data: { mime_type: payload.mimeType, data },
              })),
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: INGREDIENT_SCHEMA,
          // Cataloguing is a perception task, not a creative one.
          temperature: 0,
        },
      }),
    });
  } catch (error) {
    console.error('Gemini request failed', error);
    return errorResponse('Could not reach photo recognition.', 502);
  }

  if (!geminiResponse.ok) {
    // The upstream body can carry key material or quota detail; log it, never
    // forward it.
    console.error(`Gemini returned ${geminiResponse.status}`, await geminiResponse.text());
    return errorResponse('Photo recognition failed.', 502);
  }

  const text = extractText(await geminiResponse.json());
  if (text === null) {
    console.error('Gemini response carried no text part.');
    return errorResponse('Photo recognition returned nothing usable.', 502);
  }

  let items: z.infer<typeof DetectedItems>;
  try {
    items = DetectedItems.parse(JSON.parse(text));
  } catch (error) {
    console.error('Gemini output failed validation', error, text.slice(0, 500));
    return errorResponse('Photo recognition returned an unexpected shape.', 502);
  }

  return jsonResponse({ items });
});

/**
 * Pulls the JSON string out of the candidate envelope. `unknown` in, narrowed
 * by hand — the envelope is a third-party contract and shape-checking it is
 * cheaper than debugging a destructuring crash in a deployed function.
 */
function extractText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;

  const candidates = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content?.parts;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    const value = (part as { text?: unknown }).text;
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }

  return null;
}
