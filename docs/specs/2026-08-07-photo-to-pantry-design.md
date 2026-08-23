# Photo → pantry design

**Date:** 2026-08-07
**Status:** Implemented; live Gemini compatibility still requires a smoke test

## Goal

Turn one or more kitchen photos into ingredient candidates that the user reviews
before anything enters the pantry.

## Current contract

Detection is read-only. The Edge Function accepts compressed images, calls the
pinned `gemini-3.6-flash` model, validates structured output, normalizes names,
and returns candidates. It never writes inventory.

The client owns confirmation and persistence:

1. capture or select images in `app/scan.tsx`;
2. submit them to `supabase/functions/analyze-pantry-photo/`;
3. resolve returned labels through `src/lib/ingredients/`;
4. let the user remove or correct candidates;
5. add only confirmed items to the pantry.

Camera access is optional and is not an onboarding gate.

## Boundaries

- Gemini keys live only in Supabase secrets.
- CORS preflight runs before authentication and every response includes CORS
  headers.
- Request size and image count are bounded before the vendor call.
- Vendor output is `unknown` until Zod validation succeeds.
- Ingredient normalization must remain compatible with catalog normalization.
- No real user image belongs in tests, logs, analytics, or fixtures.

## Failure behavior

Permission denial, unsupported capture, invalid output, timeout, and vendor
failure return the user to an actionable state. Existing pantry data remains
unchanged. Error copy never exposes upstream details or secrets.

## Web capture

The web implementation uses the shared camera boundary documented in
`2026-08-10-web-webcam-capture-design.md`. Native and web produce the same
candidate-confirmation flow.

## Testing

Pure tests cover candidate validation, normalization, duplicate handling, and
confirmation. Edge Function tests cover request bounds, CORS, authentication,
structured-output failure, and safe error responses. Client tests cover
permission denial, retry, removal, correction, and confirmed writes.

After deployment, run one synthetic-image smoke test against live Gemini. CI
must not consume API quota.

## Risks

- Model or schema drift can break a request unit tests cannot exercise.
- Thin catalog vocabulary can turn valid labels into partial matches.
- Overconfident allergen interpretation would create a false safety promise;
  detection identifies ingredients, not allergen guarantees.
