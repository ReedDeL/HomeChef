# HomeChef

Photo-based meal decision engine. Application42.
Launch: Aug 24, 2026. Full specs in `docs/`.

## What this is

Not a recipe search engine — a **decision engine**. It consumes constraints
(time, equipment, pantry, allergens) and emits 3-4 answers. Showing more
options is a regression, not a feature.

## Stack

- Expo 57 · React Native 0.86 · React 19.2 · TypeScript 6.0 (`strict: true`)
- expo-router (file-based, typed routes)
- TanStack Query (server state) · Zustand (client state)
- Supabase — Postgres, Auth, RLS, Storage, Edge Functions
- Recipes: a rights-first HomeChef catalog. Approved checksum-pinned bulk
  archives build protected hosted releases and a curated offline fallback.
- Vision: `gemini-3.6-flash` via Edge Function, structured outputs + Zod
  (2.0 Flash is SHUT DOWN — never emit `gemini-2.0-flash`. Pin the stable
  string, not `gemini-flash-latest`, which hot-swaps on release.)
- Voice: `@react-native-voice/voice` via Expo config plugin, tap-to-listen

## Architecture rules

- **`src/engine/` is PURE.** No React, no imports from `src/lib/`, no I/O.
  It takes a `Recipe[]` and does not know whether candidates are hosted or
  offline. This keeps it testable without a device, network, or API quota.
- **No recipe-provider APIs.** Do not add a provider key, endpoint, quota,
  live fallback, or tier semantic. Catalog sources enter only through an
  approved, checksum-pinned rights manifest.
- **The transitional bundle is not a rebuild target.** The existing
  provider-derived `src/data/*.json` is transitional and non-rebuildable. Keep
  its attribution until an approved replacement passes parity; do not claim it
  has already been removed. It currently has 812 recipes, 897 ingredients, and
  76 `unclassified` recipes.
- **Hosted plus offline.** Show the curated offline catalog immediately, merge
  bounded hosted candidates when available, and silently retain offline results
  on failure. Candidate, detail, and attribution access uses authenticated RPCs;
  clients never write catalog tables directly.
- **Third-party API keys live only in Edge Functions.** Never in the client
  bundle. Only `EXPO_PUBLIC_SUPABASE_URL` and `..._ANON_KEY` may be public.
  Gemini is only for photo-to-pantry. See `docs/06_API_KEYS_AND_ENV.md`.
- **Every table has RLS**, enabled in the same migration that creates it.
  Inventory joins to `household_id`; preferences and allergens join to `user_id`.
- **Hard constraints — equipment, allergens, dietary — are NEVER relaxed.**
  Unknown status excludes. Soft constraints (time, cuisine) may be relaxed and
  every relaxation is stated in the UI. Never silent.
- **Never show an empty results screen.** Relaxation and offline fallback are
  code paths with tests, not error states.
- **No hardcoded colors or spacing.** Use `src/theme/tokens.ts`.
- Edge Functions: CORS preflight first, CORS headers on error responses too.

## Style — see `docs/02_STYLE_GUIDE.md`

- No `any`. Use `unknown` at boundaries and narrow.
- Named exports only (except expo-router route files, which must default-export).
- Comments explain **why**. Never comment what the code already says.
- Accessibility props required on every interactive element — CI enforces this.
- Commits: imperative, under 50 chars. `Add equipment filter`, not `added filter`.
- Python (`tools/`): PEP 8 via Ruff, mypy strict, full type hints, 4-space indent.
- Line length 100, both languages.

## Vocabulary — use these exact words

`pantry` · `catalog` · `bucket` · `equipment tier` · `household` · `drift`

Synonyms are a review comment. Shared vocabulary is how three people stay
coherent without meetings.

## Don't

- Don't add pgvector or hybrid search. The bounded catalog ranks client-side in
  under 10ms; server filtering is for access and hard-constraint prefiltering.
- Don't add recipe-provider APIs, keys, endpoints, or a replacement tier model.
- Don't persist unapproved source content or omit attribution from an active
  release.
- Don't add a Python service layer. Python is build-time tooling only.
- Don't suggest MongoDB or Firebase. The roommate privacy requirement is
  relational and enforced by RLS.
- Don't build: shopping list, barcode scanning (cut permanently), wake-word
  voice, macro tracking, roommate sharing UI. Out of scope for Aug 24.

## Docs

| File                                                    | Contents                                           |
| ------------------------------------------------------- | -------------------------------------------------- |
| `docs/specs/2026-08-22-owned-recipe-catalog-design.md`  | Rights-first catalog decision and transition rules |
| `docs/plans/2026-08-22-owned-recipe-catalog-roadmap.md` | Hosted-plus-offline implementation roadmap         |
| `docs/01_TECHNICAL_SPEC.md`                             | Architecture, data model, and decision engine      |
| `docs/02_STYLE_GUIDE.md`                                | TypeScript + PEP 8 standards, commit conventions   |
| `docs/03_COLLABORATION_BLUEPRINT.md`                    | GitHub Flow, Notion board, Definition of Done      |
| `docs/04_UIUX_SPEC.md`                                  | Screens, design tokens, interaction rules          |
| `docs/05_AI_TOOLING_PLAYBOOK.md`                        | Using AI tools without generating slop             |
| `docs/06_API_KEYS_AND_ENV.md`                           | Where every key lives, and why never the client    |

## Codex workflow

- Before substantial work, read the relevant specification and follow the
  structure and density of nearby code.
- Keep changes focused. Do not expand scope, add dependencies, alter database
  schema, rotate secrets, or contact external services without explicit approval.
- Run the relevant checks before handoff. For TypeScript changes, use
  `npm run check` when practical; for `tools/` changes, run the relevant Ruff,
  mypy, and pytest checks.
- When asked to commit, finish, ship, or save an implementation: inspect the
  diff, stage only task-specific files, and create one intentional local commit
  after verification. Never commit unrelated changes, review-only work, or
  unverified changes. Do not push or open a pull request unless explicitly asked.
