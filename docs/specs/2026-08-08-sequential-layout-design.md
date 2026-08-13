# Sequential layout — one decision per screen

**Date:** 2026-08-08
**Status:** Implemented — `app/(onboarding)/`, `app/(tabs)/`,
`src/components/ui/`. `BetaDashboard.tsx` is deleted.
**Milestone:** MVP app shell (Aug 24 launch)

## Problem

`src/components/BetaDashboard.tsx` is the entire application. `app/index.tsx`
re-exports it, `app/_layout.tsx` is a bare `<Stack>`, and no other route
exists.

That one screen presents four independent decisions before the user has made
any of them:

| Control | Elements |
|---|---|
| Time limit | 4 chips |
| Equipment preset | 3 chips |
| Pantry preset | 3 chips |
| Ingredient toggles | 15 chips |
| Summary row | 3 tiles |
| Buckets | up to 16 recipe cards |

Roughly forty interactive elements, all visible, none required. This is the
exact failure mode the product exists to eliminate. `docs/04_UIUX_SPEC.md` §0
already names it:

> Every screen is judged against one question: does this move the user closer
> to a decision, or does it give them another thing to decide?

BetaDashboard was built as a browser harness for the pure engine — its own
copy says "Photos, Supabase, and voice are not wired here yet" — and became
the app by default because nothing else was built. It is not a design that was
chosen and then went wrong. It was never chosen.

Most of this work is therefore **implementing the UI/UX spec that already
exists**, plus four deliberate alterations to it — no tab bar, photo-first
onboarding, one bucket on results, and no cuisine selector on Home — each
recorded with its rationale in Decisions 1–4 below.

## Goals

1. Every screen asks **one** question and offers **one** primary action.
2. Onboarding leads with the camera, so the user sees the product's central
   capability before paying any setup cost.
3. The results screen emits 3–4 answers, per `AGENTS.md` ("It consumes
   constraints and emits 3-4 answers. Showing more options is a regression").
4. The one-decision rule is enforced by a shared layout primitive, not by
   reviewer memory.
5. `src/engine/` is untouched. It already takes a `Recipe[]` and returns
   buckets; none of this reaches it.
6. The team keeps a working offline surface for exercising the engine without
   Supabase.
7. **The whole flow runs as a web app on any OS**, so the beta can be handed to
   testers with a URL instead of a build.

## Non-goals

- **Cook mode** (`cook/[id]`). It is the conditional feature gated on Aug 9
  (Technical Spec §8) and is a separate build. Results cards route to the
  Recipe screen, which ends in a plain scrollable steps list.
- Tier 2 / Spoonacular integration. Unrelated; the results screen renders
  whatever the engine returns regardless of tier.
- Voice. Out of scope per `AGENTS.md`.
- Real email/password auth. The photo plan's anonymous session is what these
  screens use.
- Rebuilding the decision engine, the adapters, or `useDecision`. All exist
  and are consumed as-is.

## Decisions

### 1. No tab bar

`docs/04_UIUX_SPEC.md` §2 routes Home and Pantry as `(tabs)/index` and
`(tabs)/pantry`. A tab bar is a permanently visible second decision on every
screen in the app, which is precisely what this work removes. Pantry is
reachable from one quiet row on Home — the row the spec already draws in §4:

```
📸 Update pantry · 24 items
```

Everything else is a stack. Back is the only navigation affordance.

### 2. Onboarding leads with the photo

Order becomes: **welcome → photo → confirm → equipment → allergens → home.**

`docs/04_UIUX_SPEC.md` §3 currently orders it equipment → allergens → staples
+ photo, and argues equipment should lead because it is our third wedge and no
competitor has it. That argument is about *differentiation*; the counter-
argument is about *value ordering*. Onboarding is a tax paid before any value
is received (§3's own framing), and photo capture is the only onboarding step
that is itself the product rather than a form. Leading with it means the first
results screen is built from a real pantry rather than a preset, which is the
difference between a demo and a product.

Safety is not compromised by the reorder: no recipe is rendered anywhere in
the onboarding stack, so allergens are captured before the first recipe is
ever shown.

**Photo is skippable.** A user who declines the camera falls back to the
staple-chip screen ("We assumed you have these. Tap any you don't"), which
becomes §3.4, a skip destination, rather than a mandatory step.

### 3. Results shows one bucket

`docs/04_UIUX_SPEC.md` §5 stacks all four buckets on one screen — up to
sixteen cards. `AGENTS.md` says the engine emits 3–4 answers. These have been
in conflict since both documents were written; §5 loses.

The results screen renders **`ready` only, maximum four cards**. The remaining
three buckets collapse into one row:

```
More options (11)  →
```

which pushes `(main)/more.tsx`, where the other three buckets render with the
existing §5 rules (max 4 per bucket, `missing_some` and `grocery_run`
collapsed).

The engine still computes all four buckets. Nothing about `decideWithRelaxation`
changes — this is purely which of its output the first screen renders.

**When `ready` is empty**, the relaxation ladder has already run
(`src/engine/relax.ts` promotes `missing_few` into the target count), so the
top bucket is populated by promotion and the relaxation banner explains why.
The empty-results case remains structurally impossible, per §5.3.

### 4. Spec alterations

`docs/04_UIUX_SPEC.md` is edited as part of this work, not left to drift:

| § | Change |
|---|---|
| §2 | Screen inventory: routes de-tabbed; onboarding reordered; welcome and `(main)/more` added; `DecisionScreen` named as the enforcement mechanism |
| §3 | Onboarding order rewritten per Decision 2; new §3.0 welcome and §3.3 photo/confirm; staples demoted to §3.4, the photo skip destination; equipment appliance pills explicitly demoted to progressive disclosure |
| §4 | **Cuisine selector cut from Home.** See below |
| §5 | Results renders `ready` only; §5.1 rewritten around the one-bucket rule and the More-options row |
| §12 | Tab bar added to the out-of-scope list, with the reason |

**On cutting cuisine from Home:** v1.0 placed it below a divider, optional and
de-emphasized. But a subordinate control is still a control — it makes the 6pm
user *read* the screen rather than tap it. And cuisine is the first constraint
`src/engine/relax.ts` discards when results are thin (Technical Spec §4.3): a
preference the engine is built to throw away has not earned a permanent slot on
the most important screen in the product. `useDecision` already defaults
`preferredCuisine` to `null`, so this is a UI removal with no engine change.
Revisit post-launch with usage data.

`AGENTS.md` needs no change — the results decision moves the code *toward*
what it already says.

### 5. `DecisionScreen` — the rule as a type, not a convention

A shared primitive at `src/components/DecisionScreen.tsx`:

```ts
export interface DecisionScreenProps {
  /** The single question. Rendered as `display`. */
  question: string;
  /** One clarifying line, optional. Rendered as `body` / textMuted. */
  detail?: string;
  /** The decision itself — chips, cards, camera, whatever it is. */
  children: ReactNode;
  /** Exactly one. Full width, 56pt, accent. */
  primaryAction: DecisionAction;
  /** Skip, back, "I'll do this later". Text-only, subordinate. */
  secondaryAction?: DecisionAction;
  /** 1-indexed. Renders progress dots. Omit outside onboarding. */
  step?: { current: number; total: number };
}
```

`primaryAction` is singular and required; `secondaryAction` is singular and
optional. A second primary CTA is a type error rather than a review comment.
This is what stops the rule from eroding the first time someone needs to "just
add one more toggle."

Every onboarding screen and Home are built on it. Results, More, Recipe, and
Pantry are not — they are content screens, not decision screens, and forcing
them through the primitive would distort it.

### 6. Onboarding completion lives in Postgres, not on the device

`user_preferences.onboarding_done` already exists, and
`updatePreferences({ onboardingDone })` in `src/lib/queries/preferences.ts`
already writes it. `app/index.tsx` reads it and redirects. No new storage, no
MMKV key, no Zustand store for this.

### 7. Supabase-unconfigured falls back to the beta harness

`useDecision` reads the pantry from Supabase. With no configured project there
is no pantry, and a results screen with nothing on it would violate "never a
dead end" (§0 rule 3).

The photo-to-pantry design explicitly forbids a second durable pantry store
("Supabase is the single source of truth; TanStack Query is a cache, never a
second durable store"). Rather than reintroduce one, `app/index.tsx` redirects
to `/dev/beta` when `isSupabaseConfigured` is false.

`BetaDashboard` is **preserved and moved**, not deleted. It is how the team
exercises the pure engine in a browser with no network — the `npm run web:beta`
workflow that already exists — and it keeps that job. It simply stops being
the application.

### 8. Web is a first-class beta target, via a `.web.ts` storage adapter

The beta is distributed as a URL, not a build, so every screen here must run in
a desktop browser on any OS.

`npm run web:beta` already builds and serves an SPA, and `scripts/serve-web.mjs`
already falls back to `index.html` for unknown paths. But it works **today only
because nothing imports `@/lib/supabase` yet** — the photo-to-pantry design says
so in as many words. This work changes that: every screen from the routing gate
onward needs a session, and the Supabase client stores it in
`src/lib/storage.ts`, which breaks in a browser at module load for two verified
reasons:

- `react-native-mmkv@4`'s web build throws outright when passed an
  `encryptionKey`, and `storage.ts` always passes one.
- `expo-secure-store`'s web implementation is literally `export default {}`, so
  `SecureStore.getItem` calls `undefined(...)`.

The fix is a sibling `src/lib/storage.web.ts` exporting the same three symbols.
Metro resolves `.web.ts` ahead of `.ts` for the web bundle, so no caller
changes and **no `Platform.OS` branching enters the codebase** — the platform
split stays at the file boundary, where it can't leak into screen code.

Web is deliberately a **lower-security target than native**: no keychain, no
encryption at rest, `localStorage` origin scoping only. That is acceptable for
the beta because the only thing stored is an anonymous Supabase session whose
access is already RLS-scoped to one `household`. It is not acceptable for a
production native build, and native keeps the encrypted MMKV path unchanged.

**One consequence worth naming now:** `expo-camera` on web needs a secure
context, so the photo step only works over HTTPS or `localhost`. On a plain-HTTP
LAN address it must route to the staples skip path with honest copy, never a
dead end. Testing photo capture across machines therefore needs a tunnel or a
hosted deploy — a deployment decision, not a code one.

## Architecture

```
app/
  _layout.tsx              Stack + QueryClientProvider + ensureAnonymousSession
  index.tsx                gate: !configured → /dev/beta
                                 !onboarding_done → /welcome
                                 else → /home
  (onboarding)/
    _layout.tsx            Stack, headerShown: false
    welcome.tsx        1   "What's for dinner?"
    photo.tsx          2   camera            → PhotoCapture (photo plan Task 18)
    confirm.tsx        3   detected items    → DetectionConfirmSheet (Task 18)
    staples.tsx        —   photo skip destination
    equipment.tsx      4   tier cards + appliance pills
    restrictions.tsx   5   allergens + dietary presets
  (main)/
    _layout.tsx
    home.tsx               time only
    results.tsx            ready bucket, ≤4 cards, relaxation banner
    more.tsx               the other three buckets
  recipe/[id].tsx          ingredients + steps
  pantry/
    index.tsx              grouped chips, add-by-photo primary
    photo.tsx              unchanged from photo plan Task 19
  dev/beta.tsx             BetaDashboard, preserved

src/lib/
  storage.web.ts           web session storage — Decision 8

src/components/
  DecisionScreen.tsx       the one-decision primitive
  RecipeCard.tsx           used by results + more
  RelaxationBanner.tsx     §5.3, with the undo affordance
  TimeTiles.tsx            three 96×96 tiles
  EquipmentTierCards.tsx   72pt selection cards
```

### Data flow

Nothing new. The seam is `useDecision(userId, TIER1_CATALOG, timeLimit)`,
which already exists and already runs the engine synchronously inside a
`useMemo`. Home holds `timeLimit` in route params, not in a store — it is one
number that belongs to one navigation, and putting it in Zustand would outlive
its meaning.

Onboarding writes go through `updatePreferences` (equipment, allergens,
dietary, onboardingDone) and the photo plan's `useConfirmPantryPhotoItems`
(pantry). Both already exist.

## Testing

The project has no React component test setup — every existing test file is
deliberately React-free, and `@testing-library/react-native` is not installed.
Adding that infrastructure is a separate decision and is **not** taken here.

What is testable in plain vitest, and must be:

- **`src/lib/navigation/onboarding-gate.ts`** — a pure function from
  `{ configured, onboardingDone, isLoading }` to a route string. The redirect
  logic is the part with real branching; extracting it makes it testable
  without a renderer.
- **`src/components/results-summary.ts`** — pure helpers: which bucket renders
  on the results screen, how many cards it truncates to, the "More options
  (N)" count, and relaxation-to-copy formatting. This is the §5 rule as
  assertable code. Note the existing `formatRelaxation` in `BetaDashboard.tsx`
  moves here rather than being reimplemented.
- **Existing engine tests** must all still pass, untouched.

Screens themselves are verified manually against the checklist in the
implementation plan.

## Risks

| Risk | Mitigation |
|---|---|
| Photo pipeline slips, blocking onboarding | Onboarding steps 2–3 are the only photo-dependent screens. Build the shell against them last; the flow already tolerates a skip, so a stubbed skip-only photo step ships a coherent app. |
| One-decision rule erodes post-launch | `DecisionScreen`'s singular `primaryAction` makes violations a type error |
| Extra taps annoy returning users | Onboarding runs once (`onboarding_done`). The returning-user path is Home → Results — two screens, one tap. |
| Spec drift between docs and code | §4 edits `docs/04_UIUX_SPEC.md` in the same change, not afterward |

## Open items

None. Cook mode is deferred by decision, not by uncertainty.
