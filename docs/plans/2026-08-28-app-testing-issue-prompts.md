# App Testing Follow-Up Prompts

**Date:** August 28, 2026  
**Purpose:** Standalone prompts for the issues found during hands-on testing

Use one prompt per focused task. Each prompt is intentionally self-contained so it can be
copied into a new coding session without the rest of this document.

Recommended order: fix pantry-driven recommendation freshness first (Prompt 3), then add
negative feedback (Prompt 2). The remaining prompts can be completed independently. Goals and
reminder onboarding are product-scope changes, so those prompts require documentation decisions
before implementation. Catalog gaps and synonym support (Prompt 8), authentic microwave meals (Prompt 9),
universal onboarding copy (Prompt 10), seamless kitchen management (Prompt 11), and the weekly
meal prep grocery reversal journey (Prompt 12) address critical usability and feature completeness.

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

## Prompt 4: Add caloric goals and weight gain/loss onboarding page before pantry staples

```text
Design and implement a caloric goals and weight gain/loss onboarding step positioned immediately
before the “We assumed you have these” pantry starter screen in HomeChef.

Before coding, read docs/agentic/OPERATING_SYSTEM.md, docs/00_PRODUCT_DIRECTION.md,
docs/04_UIUX_SPEC.md, and the supporting body-profile, portion-guidance, privacy, and
continuous-onboarding contracts in docs/specs/2026-08-22-dual-meal-journeys-design.md. Inspect the
current onboarding navigation flow in app/(onboarding)/.

Current problem:
1. Onboarding jumps directly from equipment and allergies/diet to the pre-populated pantry staples
   screen without understanding user meal intentions or caloric goals.
2. Users have no way to indicate if they want to lose weight, gain weight, or maintain their weight.
3. When goals are unspecified or weight loss is targeted, the engine does not prioritize lower-calorie,
   lighter meals.

Required behavior:
- Onboarding Placement & Sequence:
  - Add a dedicated goals onboarding screen (app/(onboarding)/goals.tsx) as Step 3 of 4:
    1. Kitchen Equipment (`/equipment`)
    2. Allergies & Dietary Restrictions (`/restrictions`)
    3. Goals & Caloric Preferences (`/goals`)
    4. Pantry Starter (`/staples` — “We assumed you have these”)
- Experience & Goal Input:
  - Ask for the primary goal in one clear, focused screen: Lose weight, Maintain weight, Gain weight,
    or a neutral Skip (“Not now / Skip”).
  - Provide progressive disclosure for optional body metrics: current weight and height (with unit
    toggles for kg/lbs and cm/ft-in).
  - Explicitly explain why height/weight is asked (“Used only to personalize portion estimates on this
    device”) and make it 100% optional.
- Decision Engine & Recommendation Impact:
  - When “Lose weight” is selected (or when caloric deficit is computed from optional profile data,
    or as the fallback when unspecified), adjust recommendation ranking weights to prioritize
    lower-calorie-density, lighter meal options.
  - When “Gain weight” is selected, prioritize nutrient-dense, higher-calorie options.
  - When “Maintain weight” or skipped, use standard balanced ranking.
  - Display helpful portion guidance on recipes with nutrition confidence: “Start with … serving(s)”
    and “Estimate only—adjust to your hunger.”
  - Caloric goals and portion guidance may influence ranking and suggested servings, but MUST NEVER
    compromise hard constraints (allergens, dietary restrictions, equipment).
- Privacy & Settings Management:
  - Store goal data locally. Never transmit health/body metrics to analytics or third parties.
  - Allow users to edit their goal, update height/weight, or permanently clear body data at any time
    from Settings.

Tests must verify the onboarding navigation order (Equipment -> Restrictions -> Goals -> Staples),
skip handling, optional metric input validation and conversion, goal persistence in kitchen store,
caloric ranking adjustments, portion estimate calculation, and accessibility labels. Complete
implementation and tests, run focused tests and npm run check, and review the final diff.
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

## Prompt 8: Expand catalog with common everyday staple recipes and ingredient synonyms

```text
Add common household staple recipes (such as a Peanut Butter & Jelly sandwich) and support for
everyday ingredient synonyms (e.g. “jelly” -> “jam”) to HomeChef's catalog and pantry search.

Before editing, read docs/agentic/OPERATING_SYSTEM.md, docs/00_PRODUCT_DIRECTION.md,
docs/01_TECHNICAL_SPEC.md, docs/specs/2026-08-22-owned-recipe-catalog-design.md, and
docs/plans/2026-08-22-owned-recipe-catalog-roadmap.md. Inspect the existing diff and preserve
unrelated work.

Current problem:
Hands-on testing revealed that the app lacks very common, elementary household recipes and basic
everyday ingredient synonyms.
Example observed during testing:
- A user added “bread” and “peanut butter” to their pantry and searched for “jelly”.
- “jelly” did not exist in the ingredient vocabulary, so the user had to manually substitute “jam”.
- After adding “bread”, “peanut butter”, and “jam”, HomeChef found zero available sandwich recipes
  (no PB&J or basic sandwich was available in the recommendation results).

Why this happens:
1. Provider-Derived Dataset Skew: The current transitional recipe bundle (src/data/recipes.json,
   ~812 recipes) was imported from a legacy recipe-provider dataset that heavily skews toward
   published dinner entrees, regional specialty dishes, and multi-step cooked meals (e.g., Caldereta,
   Peanut Butter Chicken, Battenberg cake, Num Pang baguette). It lacks elementary 2-3 ingredient
   assembly staples and quick snacks that ordinary households prepare every day.
2. Ingredient Vocabulary Gaps: The canonical vocabulary (src/data/ingredients.json) includes “jam”
   (id: “jam”) but omits “jelly”, with no synonym or alias mapping mechanism (e.g., “jelly” -> “jam”,
   “scallions” -> “green onions”). When a user types a common word like “jelly”, search returns empty.
3. Transitional Dataset Freeze vs. Owned Catalog Roadmap: The transitional bundle is read-only and
   non-rebuildable. The new rights-cleared owned catalog pipeline (tools/catalog/) is under development,
   but a curated seed of basic everyday staples (PB&J, classic grilled cheese, toast with butter/jam,
   simple scrambled eggs, tuna sandwich, etc.) has not yet been integrated into the offline fallback
   or hosted releases.

Required behavior:
- Ingredient Search & Synonym Mapping:
  - Add synonym/alias resolution to ingredient search so typing common synonyms like “jelly”
    resolves to or suggests the canonical ingredient (e.g., “jam” or adds a canonical “jelly”).
  - Ensure the ingredient vocabulary covers common pantry terms and household staples.
- Everyday Staple Recipes:
  - Curate and seed a core set of foundational everyday recipes (e.g., Peanut Butter and Jelly
    Sandwich, Classic Grilled Cheese, Scrambled Eggs, Buttered Toast, Cinnamon Toast, Tuna Salad
    Sandwich, Simple Oatmeal).
  - Each staple recipe must define accurate total time (<= 5-10 minutes), equipment (e.g. none or
    skillet/toaster if applicable), allergens (e.g. peanut, wheat/gluten, dairy, eggs), and dietary
    attributes (vegetarian, vegan, etc.) according to hard constraint standards.
- Recommendation Match Behavior:
  - When pantry contains bread, peanut butter, and jam (or jelly), the recommendation engine must
    reliably surface a Peanut Butter & Jelly Sandwich in the “You have it all” (ready) bucket.
  - Partial pantry states (e.g., bread + peanut butter) must accurately show PB&J with “Need: jam”
    in the “Missing 1 ingredient” bucket.

Tests & Verification:
- Add unit and engine tests verifying that searching for common aliases (“jelly”) finds the
  expected ingredient item.
- Add decision engine tests proving that standard staple ingredient sets (e.g. bread + peanut butter +
  jam/jelly, bread + cheddar cheese + butter) return the expected staple recipes in the ready bucket.
- Verify that hard constraints (e.g., peanut allergen filter, gluten intolerance) strictly exclude
  these new recipes when applicable.
- Complete implementation, run focused tests and npm run check, and review the final diff.
```

## Prompt 9: Curate authentic microwave meals and improve microwave recommendations

```text
Expand HomeChef's microwave catalog with authentic, realistic microwave meals (e.g., microwave pizza,
microwave burritos, microwave quesadillas, mug meals) and ensure microwave-only users receive genuine,
practical meal recommendations.

Before editing, read docs/agentic/OPERATING_SYSTEM.md, docs/00_PRODUCT_DIRECTION.md,
docs/specs/2026-08-06-microwave-seed-catalog-design.md, and docs/specs/2026-08-22-owned-recipe-catalog-design.md.
Inspect the current catalog tools/catalog/seed/microwave.json, src/data/recipes.json, and the
equipment filtering engine in src/engine/filter-hard.ts.

Current problem:
Users selecting the “Microwave only” equipment tier report that recommendations are poor and lack
practical, authentic microwave meals that people actually make or assemble in microwaves (such as
microwave pizza / tortilla pizza, microwave bean and cheese burritos, breakfast burritos, microwave
quesadillas, mug mac & cheese, loaded baked potatoes).

Required behavior:
- Seed & Catalog Expansion:
  - Curate and add genuine microwave recipes into the owned microwave seed (tools/catalog/seed/microwave.json)
    and catalog bundle, including:
    - Microwave Personal Pizza (pita / english muffin / tortilla base, marinara, cheese, toppings)
    - Microwave Bean & Cheese Burrito (tortilla, refried beans, cheddar/jack cheese, salsa)
    - Microwave Breakfast Burrito (scrambled mug egg, tortilla, cheese, optional salsa)
    - Microwave Cheese Quesadilla (tortilla, cheese, salsa)
    - Microwave Mug Mac & Cheese (pasta, water, milk/butter, shredded cheese)
    - Microwave Loaded Baked Potato (russet potato, butter, cheddar cheese, salt/pepper)
    - Microwave Steamed Rice & Veggie Bowl (pre-cooked or instant rice, frozen mixed veggies, soy sauce)
  - Every recipe must explicitly tag `equipmentRequired: ["microwave"]` and have accurate total time
    (typically 3–10 minutes).
- Safety & Culinary Standards:
  - Ground all recipes in USDA FSIS safety rules: no raw poultry, no eggs in shell (eggs must state
    "beat, or prick the yolk"), explicit standing time when carryover heating is required.
- Engine & Recommendation Matching:
  - When a microwave-only user has common pantry items (e.g., tortillas, cheese, beans, marinara,
    potatoes, bread/pita), the engine must reliably surface these authentic microwave meals in the
    “You have it all” or “Missing 1 ingredient” buckets.
  - Hard constraint verification: ensure non-microwave recipes are never served to microwave-only users.

Tests & Verification:
- Add tests in catalog validation and engine test suites proving that a microwave-only kitchen with
  standard staples returns these new microwave recipes in the ready bucket.
- Verify FSIS safety checks (no raw poultry, no shell eggs).
- Complete code and tests, run npm run check, and review the final diff.
```

## Prompt 10: Unify appliance options and make onboarding subtext universal

```text
Update HomeChef's kitchen setup onboarding and settings to present appliances cleanly as first-class
appliance options (eliminating ambiguous “Anything else?” phrasing) and use universal, functional subtext.

Before editing, read docs/agentic/OPERATING_SYSTEM.md, docs/00_PRODUCT_DIRECTION.md,
docs/04_UIUX_SPEC.md, src/store/kitchen.ts, and app/(onboarding)/equipment.tsx. Inspect the current diff.

Current problem:
1. Subtitles under equipment tiers rely on colloquial or stereotypical phrasing (for example,
   “Microwave only” is described as “Dorm room basics”, and “Microwave + kettle” as “A little more range”).
   This framing feels narrow and out of place for adult users, office kitchens, or temporary living spaces.
2. The extra equipment section is vaguely titled “Anything else?”, relegating air fryer, rice cooker,
   blender, and toaster oven to an ambiguous catch-all rather than presenting them clearly as
   standard kitchen appliance options.

Required behavior:
- Unified Appliance Options:
  - Replace the vague “Anything else?” heading with a clear, direct section title (e.g., “Appliances”
    or “Kitchen appliances”).
  - Present all appliance choices (air fryer, rice cooker, blender, toaster oven, etc.) as clear,
    first-class appliance options that users can easily multi-select.
  - Ensure visual hierarchy and grouping make it immediately obvious that these appliances expand the
    range of cookable meals alongside the base equipment tier.
- Universal Subtext & Clean Framing:
  - Replace informal/stereotyped subtitles in `EQUIPMENT_TIERS` (src/store/kitchen.ts) with universal,
    descriptive, and functional copy:
    - Microwave only: “Cook using only a microwave” (or “For kitchens with only a microwave”)
    - Microwave + kettle: “Microwave plus electric kettle or boiling water”
    - Full kitchen: “Stove, oven, and standard cookware”
- Consistency Across Surfaces:
  - Apply the same clear appliance options framing and universal copy across onboarding
    (app/(onboarding)/equipment.tsx), Settings (app/settings.tsx), and the dedicated Kitchen Setup view.
  - Review helper copy across allergens, dietary presets, and goals for professional, universal tone.

Tests & Verification:
- Update and run unit/screen tests for `EQUIPMENT_TIERS` rendering, appliance chip/card selection,
  onboarding accessibility labels, and screen snapshots.
- Verify that accessibility names and hints remain accurate and descriptive for screen reader users.
- Run npm run check and review the final diff.
```

## Prompt 11: Add a dedicated, non-destructive Kitchen Setup management UI

```text
Create a dedicated, non-destructive “Kitchen Setup” management screen in HomeChef that allows users to
reconfigure their equipment, appliances, and kitchen choices anytime without wiping out their pantry or
preferences.

Before editing, read docs/agentic/OPERATING_SYSTEM.md, docs/00_PRODUCT_DIRECTION.md,
docs/04_UIUX_SPEC.md, app/settings.tsx, app/(onboarding)/equipment.tsx, and src/store/kitchen.ts.

Current problem:
Users who need to update what appliances or equipment tier they have currently have to either scroll
through general Settings or use the destructive “Reset all data and onboarding” button, which wipes
out their entire pantry inventory and preferences. There is no dedicated, seamless way to simply
re-decide what is in the user's kitchen.

Required behavior:
- Dedicated Kitchen Setup Destination:
  - Provide a dedicated, accessible Kitchen Setup view (e.g., accessible directly from Settings and/or
    Pantry header).
  - Present the equipment tiers (Microwave only, Microwave + kettle, Full kitchen) and extra appliances
    (air fryer, rice cooker, blender, toaster oven) in a clean, focused, full-screen management interface.
- Non-Destructive Update Flow:
  - Changing equipment tier or toggling appliances immediately updates the kitchen store state and
    persists locally.
  - Preserves all confirmed pantry ingredients, saved dietary restrictions, allergens, and history.
  - Immediately recalculates recipe feasibility across Now recommendations and Plan journeys.
- Feedback & Navigation:
  - Provide clear confirmation of updated equipment and an easy return path back to Cook or Pantry.
  - Maintain full keyboard navigation, minimum 44×44 touch targets, theme support, and clear accessibility
    roles/hints.

Tests & Verification:
- Add screen and store tests proving that updating equipment via the kitchen management view updates
  engine constraints while preserving existing pantry contents and preferences.
- Verify accessibility labels, focus management, and responsive layout across mobile and desktop.
- Run npm run check and review the final diff.
```

## Prompt 12: Implement the Weekly Meal Prep reversal journey and active reminder scheduling

```text
Implement the complete Weekly Meal Prep experience in HomeChef, featuring the “meal prep reversal”
workflow that derives consolidated grocery lists from user meal prep choices and schedules cooking
reminders.

Before coding, read docs/agentic/OPERATING_SYSTEM.md, docs/00_PRODUCT_DIRECTION.md,
docs/04_UIUX_SPEC.md, docs/specs/2026-08-13-weekly-meal-prep-design.md,
docs/specs/2026-08-13-meal-prep-notifications-design.md, docs/specs/2026-08-22-dual-meal-journeys-design.md,
and inspect src/engine/plan-week.ts, src/engine/plan-grocery-needs.ts, and src/lib/meal-prep-notifications.ts.

Current problem:
1. The Weekly Meal Prep journey is missing from the primary app experience (there is no Plan tab or
   guided planning flow in app/(tabs)/).
2. The core “reversal” concept—where planning meals for the week automatically generates a consolidated
   grocery list of missing ingredients based on user decisions—is not accessible to users.
3. Meal prep cooking reminders exist in isolation in Settings without being connected to confirmed
   weekly meal prep plans.

Required behavior:
- Plan Tab & Navigation:
  - Add the Plan destination as a primary tab in app/(tabs)/ (Cook, Plan, Pantry) or dedicated journey.
- 3-Step Guided Planning Tree:
  - Step 1 (Days): Select how many days to plan (e.g., 3 days, 5 days, 7 days).
  - Step 2 (Prep Style): Quick meals, batch prep, or a balanced mix.
  - Step 3 (Variety): Variety across meals or comfortable repeats.
- Deterministic Plan Generation & Meal Swap:
  - Generate a recommended plan honoring all hard constraints (equipment, allergens, diet) and pantry state.
  - Allow users to review each day's planned meal and swap/replace individual meals on demand.
- The Meal Prep Reversal (“What to get” Grocery List):
  - Once the plan is confirmed, derive the consolidated missing ingredient list using `plan-grocery-needs`.
  - Group repeated ingredient needs across multiple meals and clearly indicate which meals require each item.
  - Exclude ingredients already present in the user's pantry.
  - Allow checking off or adding purchased items directly to the pantry upon user confirmation.
- Active Cooking Reminders Integration:
  - When a plan is confirmed and reminders are enabled, automatically schedule local notifications
    for each concrete planned meal using the user's selected lead time (0, 10, 15, 30, 60 minutes).
  - Clear stale reminders when a plan is replaced or reset.
  - Web platform shows honest unsupported/no-op state without errors.

Tests & Verification:
- Add tests covering the full decision tree, deterministic plan proposal, individual meal swaps,
  consolidated grocery list calculation from planned meals, pantry subtraction, reminder scheduling on
  plan confirmation, and tab accessibility.
- Run focused tests and npm run check, and review the final diff.
```
