# Implementation prompt — sequential layout

> Copy everything below the line into a fresh agent session running in the
> HomeChef repository root.

---

You are implementing the sequential layout refactor for HomeChef, an Expo /
React Native photo-based meal decision engine launching August 24, 2026.

**Read these three files before writing any code. They govern everything here
and they win any disagreement with this prompt:**

1. `AGENTS.md` — architecture rules, vocabulary, and the "Don't" list
2. `docs/specs/2026-08-08-sequential-layout-design.md` — the
   governing design for this work, including the rationale for every decision
   below
3. `docs/04_UIUX_SPEC.md` v1.1 — screens, tokens, copy rules, accessibility

Then use the `superpowers:subagent-driven-development` or
`superpowers:executing-plans` skill to work through the tasks task-by-task, and
`superpowers:test-driven-development` for every task that has a test.

## What you are building and why

`src/components/BetaDashboard.tsx` is currently the entire application — one
screen carrying four independent decisions and up to sixteen recipe cards,
roughly forty interactive elements, none of them required. It was built as a
browser harness for the pure engine and became the app by default.

You are replacing it with a sequential flow where **every screen asks one
question and offers one primary action**, and where the fridge photo leads
onboarding instead of trailing it.

You are not redesigning the product. Most of this is implementing a spec that
already exists.

## Prerequisite — check this first

This work depends on the photo-to-pantry pipeline
(`docs/plans/2026-08-08-photo-to-pantry.md`), specifically:

| From | You need |
|---|---|
| Task 9 | `isSupabaseConfigured` (a boolean const) in `src/lib/env.ts` |
| Task 10 | lazy `supabase` client that does not throw at import |
| Task 16 | `ensureAnonymousSession()`, `PHOTO_PANTRY_WRITE_ENABLED` |
| Task 18 | `PhotoCapture`, `DetectionConfirmSheet`, `usePantryPhoto` hooks |

**Verify these exist before starting.** If Tasks 1–18 have not landed, stop and
report that rather than stubbing the photo pipeline — a stubbed camera makes
Task 4 below meaningless, since the photo step is the whole point of the
reorder.

**This work supersedes photo-plan Task 19.** That task wires the camera into
`BetaDashboard` via a `<Link href="/pantry/photo">` chip. That seam disappears
here. If Task 19 already landed, remove the chip it added to `BetaDashboard`
when you get to Task 2; keep `app/pantry/photo.tsx` exactly as it is.

## Global constraints

These are review-blocking. CI enforces several of them.

- TypeScript `strict: true`. **No `any`** — use `unknown` at boundaries and
  narrow.
- **Named exports only**, except files under `app/`, which are expo-router
  routes and must default-export.
- **No hardcoded colors, spacing, radii, or font sizes.** Everything comes from
  `src/theme/tokens.ts` (`palette`, `type`, `space`, `radius`, `touchTarget`).
  If you need a value that isn't there, add it to the tokens file with a
  comment explaining why — do not inline it.
- **Accessibility props on every interactive element**: `accessible`,
  `accessibilityRole`, `accessibilityLabel`, and `accessibilityHint` wherever
  the consequence isn't self-evident. Follow the existing pattern in
  `src/components/IngredientChip.tsx`.
- **`src/engine/` is pure and stays untouched.** No file in this work may
  import React into it or add I/O to it. `src/engine/purity.test.ts` enforces
  this — do not modify that test.
- **Comments explain *why*, never what the code already says.** Match the
  density and voice of `src/engine/types.ts` and `src/components/IngredientChip.tsx`.
- **Vocabulary**, exactly these words: `pantry`, `catalog`, `bucket`,
  `equipment tier`, `household`, `drift`. Synonyms are a review comment.
- **Copy rules** (`docs/04_UIUX_SPEC.md` §10): second person, contractions,
  under ten words where possible, never blame the user, never expose internals
  ("confidence score", "sync error"), and **no exclamation marks**.
- Line length 100. Commits imperative and under 50 chars.
- Run `npm test && npm run typecheck && npm run lint && npm run format:check`
  before every commit. All four must pass.
- **Web is a first-class target for the beta.** Every screen you build must work
  in a desktop browser via `npm run web:beta`, on any OS. Do not use a native-only
  API without a web path — see Task 0.

## Testing reality — read this before you plan any test

The project has **no React component test setup**. `@testing-library/react-native`
is not installed, and every existing test file is deliberately React-free —
`src/components/ingredient-chip-label.test.ts` says so in its own header
comment, which is why the *label logic* lives in a separate plain-TS file from
the *component*.

**Do not install a component testing library.** That is a separate decision
outside this work.

Instead, follow the pattern the codebase already established: **extract the
logic worth testing into a plain-TS module beside the component, and test
that.** Tasks 1 and 6 below do exactly this. Screens themselves are verified
manually against the checklist in Task 12.

---

## Task 0: Make the web build survive the auth path

**Do this first. Nothing else in this plan runs in a browser until it's done.**

**Files**
- Create `src/lib/storage.web.ts`
- Modify `app.json`

### The problem, verified

The beta must run as a web app on any OS. `npm run web:beta` works **today only
because nothing imports `@/lib/supabase` yet** — the photo-to-pantry design says
so explicitly. This plan changes that: every screen from Task 3 onward depends
on a Supabase session, and the Supabase client's session storage is
`src/lib/storage.ts`.

That file breaks in a browser, at module load, in two independent ways:

1. **MMKV.** `react-native-mmkv@4` *does* ship a web build backed by
   `localStorage`, but its first two lines are:
   ```ts
   if (config.encryptionKey != null) {
     throw new Error("MMKV: 'encryptionKey' is not supported on Web!")
   }
   ```
   `storage.ts` always passes `encryptionKey`.

2. **SecureStore.** `expo-secure-store`'s entire web implementation is
   `export default {}`. `SecureStore.getItem` calls
   `ExpoSecureStore.getValueWithKeySync(...)`, which on web is `undefined(...)`
   — a TypeError.

Verify both for yourself before starting:
`node_modules/react-native-mmkv/src/createMMKV/createMMKV.web.ts` and
`node_modules/expo-secure-store/build/ExpoSecureStore.web.js`.

### The fix

Create `src/lib/storage.web.ts`. Metro resolves `.web.ts` over `.ts`
automatically for the web bundle, so **no caller changes and no `Platform.OS`
branching anywhere** — that's the whole point of using the extension.

It must export the same three symbols as `storage.ts` — `storage`, `getJSON`,
`setJSON` — with identical signatures, so the two files stay drop-in
interchangeable. Keep `getJSON`/`setJSON` byte-identical in behavior, including
the corrupt-value warn-then-remove path.

The difference is only in how `storage` is constructed: call `createMMKV({ id:
'homechef-kv' })` with **no `encryptionKey`**, and do not import
`expo-secure-store` at all.

Write a comment explaining why the encryption is absent rather than leaving it
looking like an oversight. The substance: a browser has no keychain, and a key
shipped in a JS bundle protects nothing from anyone who can read the bundle.
`localStorage` is already origin-scoped, which is the actual boundary on web.
State plainly that this makes web a **lower-security target than native**, and
that it is acceptable for the beta because the only thing stored is a Supabase
session for an anonymous user with RLS-scoped access to one `household`.

### Web config

`app.json` currently has no `web` key at all. Add one:

```json
"web": { "bundler": "metro", "output": "single" }
```

`output: "single"` is what makes expo-router emit a single-page app, which is
what `scripts/serve-web.mjs` already assumes — it falls back to `index.html` for
unknown paths. Do not switch to static output; it would break that fallback and
every deep link in this plan.

### Camera on the web

`expo-camera` on web uses `getUserMedia`, which browsers only expose in a
**secure context** — HTTPS, or `localhost`. Over plain HTTP on a LAN address the
camera silently fails to initialize.

This matters because the photo step leads onboarding. Handle it as a normal
state, not an error, per `docs/04_UIUX_SPEC.md` §10:

- The photo screen must detect that capture is unavailable and route the user to
  the `staples` skip path with honest copy — *"Camera needs a secure connection.
  Add your staples instead."* Never "getUserMedia failed", never a stack trace,
  and never a dead end.
- Verify this branch by loading the beta over a LAN IP, not just `localhost`.

Report to the team that testing the photo flow across machines needs HTTPS —
a tunnel or a hosted deploy — rather than the plain `serve-web.mjs` on a LAN
address. That is a deployment decision, not yours to make here.

**Verify:** `npm run web:beta`, open in a desktop browser, confirm the bundle
loads with no console error from `storage`. Re-run after Task 3 and confirm the
session persists across a reload.

**Commit:** `Add web storage adapter and web config`

---

## Task 1: `onboarding-gate.ts` — the redirect rule, as a pure function

**Files**
- Create `src/lib/navigation/onboarding-gate.ts`
- Create `src/lib/navigation/onboarding-gate.test.ts`

The routing gate has real branching, so it must be testable without a renderer.
Extract it before writing the route.

```ts
export type GateDestination = '/dev/beta' | '/welcome' | '/home' | null;

export interface GateInput {
  supabaseConfigured: boolean;
  /** Undefined while the preferences query is still in flight. */
  onboardingDone: boolean | undefined;
}

/** `null` means "render nothing yet" — the preferences query hasn't resolved. */
export function resolveGateDestination(input: GateInput): GateDestination;
```

Rules, in order:

1. `supabaseConfigured === false` → `/dev/beta`. There is no pantry without
   Supabase, and a results screen with nothing on it would violate "never a
   dead end" (`docs/04_UIUX_SPEC.md` §0). The beta harness is the honest
   fallback.
2. `onboardingDone === undefined` → `null` (still loading).
3. `onboardingDone === false` → `/welcome`.
4. `onboardingDone === true` → `/home`.

Note rule 1 precedes the loading check: an unconfigured project never resolves
`onboardingDone` at all, so checking loading first would hang forever.

**Test** every branch including the ordering of rules 1 and 2.

**Commit:** `Add onboarding gate resolution`

---

## Task 2: Move BetaDashboard to a dev route

**Files**
- Create `app/dev/beta.tsx`
- Modify `src/components/BetaDashboard.tsx` (copy text only, plus the Task 19
  chip removal if present)
- `app/index.tsx` is rewritten in Task 3, not here

`app/dev/beta.tsx`:

```tsx
export { BetaDashboard as default } from '@/components/BetaDashboard';
```

**Do not delete or rewrite `BetaDashboard`.** It is how the team exercises the
pure engine in a browser with no network — the existing `npm run web:beta`
workflow — and it keeps that job. It just stops being the application.

Update its hero copy so its status is unambiguous. Replace the existing
`kicker` and `body` text with:

- kicker: `Engine harness`
- body: `Offline harness for the bundled catalog and pure engine. Not the app —
  the app needs Supabase configured.`

If photo-plan Task 19's `📸 Add by photo` `<Link>` chip is present in the hero,
remove it and its now-unused `Link` import. `app/pantry/photo.tsx` stays.

**Verify:** `npm run web:beta`, navigate to `/dev/beta`, confirm the dashboard
renders exactly as before.

**Commit:** `Move beta dashboard to dev route`

---

## Task 3: Root layout and the routing gate

**Files**
- Modify `app/_layout.tsx`
- Rewrite `app/index.tsx`

`app/_layout.tsx` currently renders a bare `<Stack>` with no query client — add:

- `QueryClientProvider` with a module-level `QueryClient` (created once outside
  the component, not per render)
- `SafeAreaProvider` from `react-native-safe-area-context`
- `ensureAnonymousSession()` on mount, but **only when `isSupabaseConfigured`**
  — calling it unconfigured throws
- Keep `headerShown: false` on the `Stack`; these screens draw their own headers

`app/index.tsx` becomes the gate: read `isSupabaseConfigured` and the
preferences query, pass both to `resolveGateDestination`, and render
`<Redirect href={destination} />` or `null`.

Keep this file thin. All branching logic is in Task 1's tested function; this
file only wires data into it.

**Commit:** `Add query provider and routing gate`

---

## Task 4: `DecisionScreen` — the one-decision primitive

**Files**
- Create `src/components/DecisionScreen.tsx`

This is the most important file in the task list. It is what stops the
one-decision rule from eroding the first time someone needs to "just add one
more toggle."

```ts
export interface DecisionAction {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  disabled?: boolean;
}

export interface DecisionScreenProps {
  /** The single question. Rendered as `display`. */
  question: string;
  /** One clarifying line at most. Rendered as `body` in `textMuted`. */
  detail?: string;
  /** The decision itself — chips, cards, camera, whatever it is. */
  children: ReactNode;
  /** Exactly one. Full width, `touchTarget.primaryCtaHeight`, accent. */
  primaryAction: DecisionAction;
  /** Skip / "I'll do this later". Text-only and visually subordinate. */
  secondaryAction?: DecisionAction;
  /** 1-indexed. Renders progress dots. Omit outside onboarding. */
  step?: { current: number; total: number };
}
```

`primaryAction` is **singular and required**; `secondaryAction` is **singular
and optional**. Do not widen either to an array, and do not add a third action
slot. A second primary CTA must be a type error.

Requirements:

- `SafeAreaView` root, `theme.bg` background, light/dark via `useColorScheme()`
  exactly as `BetaDashboard` and `IngredientChip` already do it
- Progress dots get `accessibilityRole="progressbar"` and an
  `accessibilityLabel` of `Step {current} of {total}`
- The primary CTA is full-width and `touchTarget.primaryCtaHeight` tall
- `children` scrolls if it overflows; the CTA does **not** scroll away — it is
  pinned below the scroll area
- Layout must reflow at 200% Dynamic Type without clipping — no fixed heights
  on text containers

**Commit:** `Add DecisionScreen layout primitive`

---

## Task 5: The onboarding stack

**Files**
- Create `app/(onboarding)/_layout.tsx`
- Create `app/(onboarding)/welcome.tsx`
- Create `app/(onboarding)/photo.tsx`
- Create `app/(onboarding)/confirm.tsx`
- Create `app/(onboarding)/staples.tsx`
- Create `app/(onboarding)/equipment.tsx`
- Create `app/(onboarding)/restrictions.tsx`
- Create `src/components/EquipmentTierCards.tsx`

Order is **welcome → photo → confirm → equipment → restrictions → home**, with
`staples` as the photo skip destination. Every screen uses `DecisionScreen`.
Full copy and layout are in `docs/04_UIUX_SPEC.md` §3.

Per-screen notes:

**welcome** (step 1/5) — one line, one button, nothing else. Its only job is to
make the camera permission prompt on the next screen feel like part of a
sequence rather than an ambush.

**photo** (step 2/5) — wraps the existing `PhotoCapture` from the photo plan.
Primary: capture. Secondary: `I'll add them myself` → `/staples`. Do not
reimplement any capture or compression logic.

**confirm** (step 3/5) — wraps the existing `DetectionConfirmSheet`. Items under
0.7 confidence are pre-flagged; the sheet already handles this. Nothing writes
to `inventory` before this screen is confirmed.

**staples** — skip destination, not a numbered step. Assumed staples as
`IngredientChip`s from `STAPLE_INGREDIENT_IDS` (`src/data/catalog.ts`), tap to
remove. Copy: *"We assumed you have these. Tap any you don't."* Keep a secondary
link back to the camera — declining once is not declining forever.

**equipment** (step 4/5) — `EquipmentTierCards`, 72pt tall, single-select, using
the three tiers already defined as `EQUIPMENT_PRESETS` in `BetaDashboard.tsx`.
Move that constant into `src/data/equipment-tiers.ts` and import it from both
places rather than duplicating it. The "Anything else?" appliance pills are
**progressive disclosure below the tier cards**, not a co-equal section — a user
who never scrolls past the three cards has answered the question correctly.

**restrictions** (step 5/5) — allergens and dietary presets, multi-select,
skippable with "Add later in settings". Copy: *"We'll never suggest a recipe
with these. Promise."* On continue, write everything via `updatePreferences`
(`src/lib/queries/preferences.ts`) including `onboardingDone: true`, then
`router.replace('/home')`.

Use `router.replace`, not `push`, on the final step so back doesn't re-enter
onboarding.

**Commit:** `Add sequential onboarding flow`

---

## Task 6: `results-summary.ts` — the §5 rule as tested code

**Files**
- Create `src/components/results-summary.ts`
- Create `src/components/results-summary.test.ts`

Pure functions, no React. This is where the one-bucket rule becomes assertable
rather than a convention buried in JSX.

```ts
/** Max cards on the results screen. Truncation is the product. */
export const MAX_RESULT_CARDS = 4;

/** The `ready` bucket, truncated. Nothing else renders on the results screen. */
export function primaryResults(decision: RelaxedDecision): readonly ScoredRecipe[];

/** Total across the three buckets behind "More options (N)". */
export function moreOptionsCount(decision: RelaxedDecision): number;

/** §5.3 banner copy. Returns null when no relaxation was applied. */
export function relaxationMessage(relaxations: readonly Relaxation[]): string | null;
```

`relaxationMessage` **must return `null` for `tier2_escalation`** when it is the
only relaxation. Tier escalation adds options without removing constraints, so
there is nothing to disclose and no banner (`docs/04_UIUX_SPEC.md` §5.3).

`formatRelaxation` already exists at the bottom of `BetaDashboard.tsx` — **move**
it here and have `BetaDashboard` import it. Do not leave two copies.

**Test:** truncation at exactly 4 and below 4, the more-count across all three
buckets, every `Relaxation` kind, the tier2-only null case, and the empty case.

**Commit:** `Add results summary helpers`

---

## Task 7: Home

**Files**
- Create `app/(main)/_layout.tsx`
- Create `app/(main)/home.tsx`
- Create `src/components/TimeTiles.tsx`

One question: *"How much time do you have?"* Three 96×96 tiles — 15 / 30 / 60+ —
per `docs/04_UIUX_SPEC.md` §4. A slider is a decision; three buttons are a
reflex.

Tapping a tile navigates straight to results, passing the time limit as a route
param. The "Show me meals" CTA is a fallback for users who expect a confirm
step, not the required path.

Below the CTA, one quiet `caption` row: `📸 Update pantry · N items`, linking to
`/pantry`. It is a link, not a decision. `N` comes from `useInventory`.

**There is no cuisine selector.** v1.0 of the spec had one below a divider;
v1.1 cut it. Do not add it back.

Hold the time limit in route params, not in a store — it is one number that
belongs to one navigation, and Zustand would outlive its meaning.

**Commit:** `Add home time selection screen`

---

## Task 8: Results

**Files**
- Create `app/(main)/results.tsx`
- Create `src/components/RecipeCard.tsx`
- Create `src/components/RelaxationBanner.tsx`

Renders **one bucket — `ready`, max 4 cards** — via `primaryResults`. Then one
row: `More options (N) →` pushing `/more`. That's the whole screen.

Data comes from the existing `useDecision(userId, TIER1_CATALOG, timeLimit)`.
Do not call the engine directly and do not add a second data path — that hook is
the seam and it already runs the engine synchronously inside a `useMemo`.

`RecipeCard` requirements:

- `accessible` on the card root so a screen reader announces it as **one unit,
  not four fragments** (`docs/04_UIUX_SPEC.md` §9)
- Always shows required equipment — constant proof the app respects the
  constraint the user declared
- Missing ingredients render as `IngredientChip`, never as plain text. Every
  ingredient name anywhere in the app is a chip, and every chip is
  long-pressable for "I don't have this." This is the `drift` mitigation and
  re-implementing it per screen is exactly how the gesture goes missing.
- Tier 2 recipes (`recipe.source === 'tier2'`) show a `caption` source line.
  Tier 1 shows no badge — it's just a recipe.

`RelaxationBanner` renders `relaxationMessage` output in `surfaceAlt` — **not**
`danger`, which is reserved exclusively for allergen warnings — with the undo
affordance from §5.3. Render nothing when the message is `null`.

Results updating after a drift correction announces via `aria-live="polite"`.

**No empty state.** If `primaryResults` returns nothing, the engine has a bug —
`src/engine/relax.ts` promotes `missing_few` into `ready` before that can
happen. Do not paper over it with an empty-state component.

**Commit:** `Add results screen with single bucket`

---

## Task 9: More options

**Files**
- Create `app/(main)/more.tsx`

The other three buckets: `missing_few` expanded, `missing_some` and
`grocery_run` collapsed behind a count. Max 4 cards each. Reuses `RecipeCard`.

This screen exists for completeness, not for browsing. Do not add sorting,
filtering, or a "show all" affordance.

**Commit:** `Add more options screen`

---

## Task 10: Recipe

**Files**
- Create `app/recipe/[id].tsx`

Per `docs/04_UIUX_SPEC.md` §6. Hero image, title, time/equipment/cuisine
caption, ingredients, steps.

Ingredients the user has are checked and full-contrast; missing ones are muted
with an inline "I have this" correction. **Drift correction runs in both
directions** — the app is as wrong about what you lack as about what you have.

The `Start cooking` CTA is **out of scope for this work** — cook mode is the
conditional Aug 9 gate feature and a separate build. Render the steps as a plain
scrollable list and omit the CTA entirely. Do not stub a broken button.

**Commit:** `Add recipe detail screen`

---

## Task 11: Pantry

**Files**
- Create `app/pantry/index.tsx`

Grouped by category, `IngredientChip` per item with a remove affordance. Two
entry paths always visible: **📸 Add by photo** (primary) and **＋ Add manually**
(secondary). The photo path links to the existing `app/pantry/photo.tsx` —
unchanged.

**Commit:** `Add pantry screen`

---

## Task 12: Verification

Run the full gate:

```
npm test && npm run typecheck && npm run lint && npm run format:check
```

All four must pass, including every pre-existing engine test unmodified.

Then verify manually. Report the actual result of each item — if something
fails, say so with the output rather than reporting the task complete.

**Without `.env`:**
- [ ] App boots to `/dev/beta`, no white screen, no crash
- [ ] BetaDashboard renders and the engine still filters correctly

**With `.env` and a local Supabase stack:**
- [ ] Fresh user lands on `/welcome`
- [ ] Full onboarding completes: welcome → photo → confirm → equipment →
      restrictions → home
- [ ] Skipping the photo routes to `/staples` and onboarding still completes
- [ ] Relaunching after onboarding goes straight to `/home` — onboarding does
      not repeat
- [ ] Home shows three time tiles, no cuisine row, and a pantry count
- [ ] Tapping a tile goes straight to results
- [ ] Results shows at most 4 cards and exactly one bucket
- [ ] `More options (N)` shows the correct count and pushes a working screen
- [ ] A recipe card opens the recipe screen
- [ ] Relaxation banner appears when a soft constraint is relaxed, and does
      **not** appear for tier 2 escalation alone

**Web — the beta target, so this is not optional:**
- [ ] `npm run web:beta` builds and serves with no console error from `storage`
- [ ] The whole flow above completes in a desktop browser: onboarding → home →
      results → more → recipe → pantry
- [ ] The Supabase session survives a page reload
- [ ] Browser back/forward move through the stack correctly, and a deep link
      pasted straight into the address bar resolves (this is what `output:
      "single"` plus the `serve-web.mjs` fallback buys)
- [ ] Verified in **Chrome, Firefox, and Safari** — the beta has to work on any OS
- [ ] Layout holds from a 1440px desktop window down to a 375px mobile viewport
- [ ] Served over a LAN IP (not `localhost`), the photo screen routes to
      `staples` with the secure-connection copy instead of hanging or crashing

**Accessibility — these are Definition-of-Done gates, not polish:**
- [ ] VoiceOver/TalkBack announces each recipe card as one unit
- [ ] Every screen is fully operable with a screen reader
- [ ] Every interactive element has a label
- [ ] Layouts reflow at 200% Dynamic Type without clipping
- [ ] Verified in both light and dark mode

**Final commit:** `Verify sequential layout flow`

---

## When you're done

Report: which tasks landed, the actual output of the verification gate, and
anything you could not complete and why. Do not report completion for a task
whose manual checks you did not actually run.

If you hit something where this prompt conflicts with `AGENTS.md` or the design
spec, the spec wins — flag the conflict rather than silently picking one.
