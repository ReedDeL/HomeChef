# App Testing Follow-Up Prompts

**Date:** August 28, 2026  
**Purpose:** Standalone prompts for the issues found during hands-on testing

Use one prompt per focused task. Each prompt is intentionally self-contained so it can be
copied into a new coding session without the rest of this document.

Recommended order: fix pantry-driven recommendation freshness first (Prompt 3), then add
negative feedback (Prompt 2). The remaining prompts can be completed independently. Goals and
reminder onboarding are product-scope changes, so those prompts require documentation decisions
before implementation.

## Prompt 2: Add persistent “I don't like this” feedback

```text
Add an “I don't like this” action to HomeChef meal recommendations and make it produce a fresh,
personalized replacement.

Before editing, read docs/agentic/OPERATING_SYSTEM.md, docs/00_PRODUCT_DIRECTION.md,
docs/04_UIUX_SPEC.md, and the current recommendation, recipe-card, decision-engine, and kitchen
store code. Inspect the existing diff and preserve unrelated work.

Current problem: users cannot reject a visible suggestion from the recommendation surface.
HomeChef therefore keeps presenting food the user has explicitly decided they do not want.

Required behavior:
- Every visible recommendation exposes a secondary action labeled “I don't like this.”
- Activating it records a durable dislike for that recipe, removes the recipe from the current
  results, and reveals the next eligible recipe from the same stable ranking and constraints.
- The dislike survives an app restart and affects future Now and Plan recommendations wherever
  the shared preference contract applies.
- A disliked recipe must be excluded, not merely moved lower. Existing allergen, dietary, and
  equipment constraints remain absolute, and the action must not change the pantry.
- Do not randomize or replace unrelated cards. Preserve already-visible results and reveal the
  next valid candidate when possible.
- If no replacement exists, show a calm, explained state with an obvious recovery path. Never
  leave an unexplained blank section.
- Provide a short undo opportunity if it can be implemented without weakening persistence or
  creating conflicting preference states.

Reuse the existing dislike preference/store boundary if one exists instead of creating a
parallel storage mechanism. Keep weak “skip” and strong “dislike” signals distinct. Add an
approved analytics event only if the current analytics contract has an established pattern for
explicit recommendation feedback.

Tests must prove persistence, exclusion across a new recommendation run, immediate replacement,
stable ordering of unaffected results, empty-replacement behavior, and accessible names/states.
Announce the replacement to assistive technology and preserve logical focus. Complete the code
and tests, run focused checks followed by npm run check, and review the final diff.
```

## Prompt 3: Make “Any” recommendations respond to pantry changes

```text
Diagnose and fix HomeChef recommendations staying the same after the pantry changes when the
cuisine preference is “Any.”

Read docs/agentic/OPERATING_SYSTEM.md, docs/00_PRODUCT_DIRECTION.md, docs/04_UIUX_SPEC.md, and
the current recommendation engine, relaxation policy, pantry store, adapters, and relevant
tests. Inspect the working-tree diff before editing.

Reproduce the problem first with a controlled pantry change. Trace the complete data path from
the persisted pantry through the screen selector and engine input to feasibility buckets and
ranking. Determine whether the cause is stale state, memoization/cache keys, canonical-ID
normalization, a ranking rule that ignores pantry readiness, or presentation retaining an old
result set. Fix the actual cause rather than forcing variety with randomness.

Required behavior:
- A recommendation run always uses the latest committed pantry snapshot.
- Adding or removing an ingredient immediately updates recipe pantry-fit counts and buckets.
- When a changed ingredient materially improves or worsens recipe feasibility, the stable
  ranking and visible recommendations update accordingly.
- “Any” means no cuisine preference. It must not select a canned result set or bypass pantry
  scoring.
- Identical pantry, preferences, and time inputs remain deterministic.
- An irrelevant ingredient is allowed to leave the ranking unchanged; do not shuffle results
  merely to look fresh.
- Hard constraints are never relaxed. Any time or cuisine relaxation remains visible.

Add a regression test using catalog fixtures where one known ingredient change moves at least
one recipe between pantry-fit states and changes the expected ranking. Cover both adding and
removing the ingredient, plus a screen/store integration test that catches stale memoized state.
If the catalog cannot support a clear fixture, add a small test-only fixture rather than
weakening the assertion.

Complete the implementation and tests. Run the focused engine and screen tests, then npm run
check. Report the root cause and review the final diff for unrelated changes.
```

## Prompt 4: Add goals onboarding for portion decisions

```text
Design and implement a focused goals onboarding flow for HomeChef's optional portion guidance.

Treat this as a new product decision. Before coding, read docs/agentic/OPERATING_SYSTEM.md,
docs/00_PRODUCT_DIRECTION.md, docs/04_UIUX_SPEC.md, and the supporting body-profile,
portion-guidance, privacy, and continuous-onboarding contracts in
docs/specs/2026-08-22-dual-meal-journeys-design.md. Inspect the current code and diff to identify
which supporting contracts already exist but are not exposed in the current experience.

First update the current product/UI documentation narrowly enough to authorize goals and
portion guidance. Preserve the governing boundary: this is portion assistance, not calorie or
macro tracking, a nutrition dashboard, weight history, or medical advice.

Experience requirements:
- Ask for the user's goal in one focused step: lose, maintain, or gain. Include a neutral skip.
- Collect only the additional information required by the approved portion calculation, using
  progressive disclosure and no more than one topic per screen.
- Clearly explain why sensitive body information is requested before collection.
- Users can skip optional fields, edit the current profile later, and permanently delete it.
- Do not show daily calorie targets, macros, weight trends, or pregnancy-specific advice.
- Show guidance only for recipes with adequate nutrition confidence, using the approved copy
  “Start with … serving(s)” and “Estimate only—adjust to your hunger.”
- The guidance may change a suggested starting portion but must never decide whether a recipe is
  eligible or weaken allergens, dietary needs, or equipment constraints.

Use the existing current-profile and persistence contracts if present. Do not invent a second
profile model or retain profile history. Enforce personal ownership and RLS for server-backed
data, keep local fallback behavior explicit, and avoid analytics fields containing health or
body data. The calculation must stay pure and deterministic.

Add tests for every goal, skip behavior, editing/deletion, age and eligibility boundaries,
missing/low-confidence nutrition, rounding and clamps, privacy isolation, accessibility, and
the rule that recommendations remain eligible when guidance is unavailable. Complete docs,
implementation, and tests; run the focused checks and npm run check. Call out any required
nutrition/privacy review that cannot be automated.
```

## Prompt 5: Polish the Settings action

```text
Polish HomeChef's Settings action across every screen where it appears.

Read docs/agentic/OPERATING_SYSTEM.md, docs/00_PRODUCT_DIRECTION.md,
docs/04_UIUX_SPEC.md, the theme tokens, shared button/icon primitives, and all current Settings
entry points. Inspect the existing diff before editing.

Current problem: the “⚙️ Settings” control relies on an emoji glyph and caption styling, so its
font, alignment, and rendering vary by platform and look unfinished.

Required behavior:
- Replace the emoji-based label with one shared, intentional Settings action.
- Reuse an icon system already installed in the project; do not add a dependency only for this
  control. If no approved icon exists, use a polished text-only action.
- Apply the same component, sizing, spacing, color, hover/pressed/focus states, and typography
  on Now, results, Pantry, Plan, and other current entry points.
- Keep Settings secondary to the main decision on every screen.
- Maintain at least a 44×44 touch target and an accessible “Settings” name and useful hint.
- The control must align cleanly at mobile and desktop widths, support light/dark themes and
  Dynamic Type, and never clip or rely on a platform emoji font.

Remove duplicated screen-level Settings button styles when the shared component replaces them.
Do not redesign the Settings page or primary navigation as part of this task. Add component and
screen tests for rendering, navigation, accessibility, theme states, and responsive placement.

Complete the implementation, run focused tests and visual checks at representative phone and
desktop widths, then run npm run check and review the final diff.
```

## Prompt 6: Make desktop cuisine filters fully reachable

```text
Fix the cuisine/genre filter row being clipped on desktop so every option is visible or
reachable.

Before editing, read docs/agentic/OPERATING_SYSTEM.md, docs/00_PRODUCT_DIRECTION.md,
docs/04_UIUX_SPEC.md, docs/specs/2026-08-12-responsive-web-layout-design.md, and the current
responsive shell, Now screen, Chip, and filter-row implementations. Inspect the current diff.

Reproduce the bug at the actual desktop breakpoints and identify which container owns the
overflow. Check at minimum 960px, 1180px, and a wide desktop viewport, plus browser zoom and
increased text size. Do not solve the problem by shrinking labels or touch targets.

Required behavior:
- Every cuisine option, including the last option, is visible or reachable on desktop.
- Prefer a wrapped desktop layout when it remains easy to scan; otherwise provide a clearly
  scrollable horizontal rail with working mouse wheel/trackpad, keyboard, and touch behavior.
- Mobile may retain its horizontal chip rail if that is still the best phone interaction.
- No option is hidden behind a clipped parent, and the page must not gain accidental horizontal
  document overflow.
- Keyboard users can tab to every chip and always see the focused control.
- Selected state, “Any” behavior, accessibility labels, and recommendation logic remain
  unchanged.

Add a regression test that verifies the responsive layout contract and, where supported, a
browser test that reaches and activates the last option at desktop width. Verify light/dark
themes, 200% text scaling, reduced motion, and narrow mobile layout.

Complete the fix and tests, run the focused responsive/browser checks and npm run check, then
review the final diff.
```

## Prompt 7: Create a meal-prep reminders page with its own onboarding

```text
Create a dedicated meal-prep and cooking-reminders experience for HomeChef, including a short
first-visit onboarding flow.

Treat this as a product-scope addition. Read docs/agentic/OPERATING_SYSTEM.md,
docs/00_PRODUCT_DIRECTION.md, docs/04_UIUX_SPEC.md,
docs/specs/2026-08-13-meal-prep-notifications-design.md, and the current weekly-plan,
notification, settings, store, and routing code. Inspect the current diff. Update the current
product/UI docs before implementation so they distinguish this approved secondary destination
from primary Now, Plan, and Pantry navigation.

Current problem: reminder infrastructure and a Settings toggle may exist, but users do not have
a dedicated place to understand, configure, and review meal-prep reminders. There is no guided
first-use experience.

Required experience:
- Add a secondary Reminders page reachable from Settings and the confirmed Plan experience; do
  not add a fourth primary tab.
- On first visit, explain in one short screen that reminders are created only for concrete meals
  in a confirmed plan. Then ask for notification permission and reminder timing as focused,
  progressive steps. Permission denial must not block planning.
- After onboarding, show reminder status, the selected lead-time preset, and upcoming scheduled
  cooking reminders in chronological order.
- Allow reminders to be enabled/disabled, timing to be changed, onboarding guidance to be
  revisited, and platform settings to be opened after a denial where supported.
- Use only the approved lead presets: 0, 10, 15, 30, and 60 minutes.
- Schedule at planned meal time minus the greater of recipe duration and selected lead time.
- Draft plans, “Decide that day” entries, and one-off Now recommendations never schedule.
- Replacing or deleting a confirmed plan clears stale reminders before syncing replacements.
- Web provides an honest unsupported/no-op state and never pretends reminders were scheduled.

Reuse the existing notification boundary and persisted preference if present. Do not create a
remote push service, cron job, Edge Function, general calendar, or dedicated cook mode. Avoid
displaying dietary, allergy, pantry, or health information in notification content.

Tests must cover first-visit onboarding, repeat visits, permission grant/denial, every lead
preset, confirmed-plan-only scheduling, chronological display, stale cancellation, timezone
handling, web fallback, settings/plan navigation, and accessibility. Complete documentation,
implementation, and tests. Run focused checks, physical-device verification where available,
and npm run check; clearly report any device-only verification still required.
```
