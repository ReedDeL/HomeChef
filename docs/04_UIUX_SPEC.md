# HomeChef — UI/UX Specification

**Company:** Application42 · **Product:** HomeChef
**Version:** 1.0 · **Date:** August 3, 2026
**Scope:** August 24 MVP

---

## 0. Design Principle

> **SuperCook tells you what you *can* make. We tell you what to make.**

Every screen below is judged against one question: **does this move the user closer to a decision, or does it give them another thing to decide?**

Three rules follow, and they override any other design instinct:

1. **Subtraction beats addition.** A feature that adds a choice must justify itself against the decision fatigue it creates. Comprehensiveness is our competitors' value proposition, not ours.
2. **The 6pm user is tired, hungry, and holding their phone in one hand.** Big targets. Few words. No modes to learn.
3. **Never a dead end.** No empty state, no error, no "no results found." Ever.

---

## 1. Design Tokens

Defined once in `src/theme/tokens.ts`. **No hardcoded colors or spacing anywhere else in the codebase** — this is a review-blocking rule, because token drift is how a two-week-old codebase starts looking like two different apps.

### 1.1 Color

Warm and appetizing without being a food-photography cliché. Every pairing below meets WCAG 2.1 AA.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#FFFCF8` | `#151312` | App background — warm white, not clinical |
| `surface` | `#FFFFFF` | `#221F1D` | Cards, sheets |
| `surfaceAlt` | `#F5F0E8` | `#2C2825` | Chips, inset areas |
| `text` | `#1A1613` | `#F5F0E8` | Primary text — 15.8:1 on `bg` |
| `textMuted` | `#6B6259` | `#A69C91` | Secondary — 4.9:1 on `bg` |
| `accent` | `#D94F14` | `#FF7A3D` | Primary action — 4.6:1 on `bg` |
| `accentText` | `#FFFFFF` | `#151312` | Text on accent — 4.8:1 |
| `ready` | `#2E7D4F` | `#4CAF7D` | "You can make this now" |
| `near` | `#C77D12` | `#E8A33D` | "Missing a few" |
| `far` | `#8A8079` | `#9C938B` | "Grocery run" |
| `danger` | `#C62828` | `#FF6B6B` | Allergen warnings only |
| `border` | `#E5DDD2` | `#38332F` | Dividers |

**`danger` is reserved exclusively for allergen warnings.** Not for validation errors, not for delete buttons. If red always means "this could hurt you," red keeps meaning it.

### 1.2 Typography

System font stack — SF Pro on iOS, Roboto on Android. No custom font: it costs bundle size, a loading state, and a layout shift, and buys us nothing at this stage.

| Token | Size / Line | Weight | Use |
|---|---|---|---|
| `display` | 34 / 40 | 700 | "What are you making?" |
| `title` | 24 / 30 | 700 | Screen titles, recipe names |
| `heading` | 19 / 25 | 600 | Bucket headers |
| `body` | 17 / 24 | 400 | Default — matches iOS default for readability |
| `bodyStrong` | 17 / 24 | 600 | Emphasis |
| `caption` | 14 / 19 | 400 | Metadata, times |
| `cookStep` | 28 / 38 | 500 | **Cook mode only** — readable from arm's length across a counter |

All sizes respect OS Dynamic Type. Test at 200% scaling; layouts must reflow, not clip.

### 1.3 Spacing, radius, elevation

4pt base scale: `xs 4` · `sm 8` · `md 16` · `lg 24` · `xl 32` · `xxl 48`

Radius: `sm 8` (chips) · `md 12` (cards) · `lg 20` (sheets) · `full 999` (pills)

Elevation: subtle only — `sm` for cards, `lg` for sheets. Flat-with-borders in dark mode, where shadows read as mud.

### 1.4 Touch targets

| Context | Minimum |
|---|---|
| Standard interactive | 44 × 44 pt |
| Ingredient chip "remove" | 44 × 44 pt (hit slop may exceed the visual chip) |
| **Cook mode next/back** | **64 × 64 pt** — sized for a knuckle or the back of a hand |
| Primary CTA | Full width, 56 pt tall |

---

## 2. Screen Inventory

Eight screens for launch. Anything not on this list is out of scope.

| # | Screen | Route | Purpose |
|---|---|---|---|
| 1 | Kitchen setup | `(onboarding)/equipment` | Declare equipment tier — asked once, ever |
| 2 | Allergies & diet | `(onboarding)/restrictions` | Safety constraints — asked once, ever |
| 3 | Pantry starter | `(onboarding)/staples` | Confirm assumed staples, first photo capture |
| 4 | **Home** | `(tabs)/index` | Time input → the decision |
| 5 | **Results** | `(tabs)/index` (same screen, post-input) | Four buckets |
| 6 | Recipe | `recipe/[id]` | Ingredients, steps, start cooking |
| 7 | Cook mode | `cook/[id]` | One step at a time, hands-free-ish |
| 8 | Pantry | `(tabs)/pantry` | View, add, correct |

---

## 3. Onboarding — three screens, under 60 seconds

Onboarding is a tax the user pays before receiving any value. Keep it short, make each screen obviously worth it, and never ask twice.

### 3.1 Kitchen setup

```
┌─────────────────────────────────┐
│                                 │
│  What's in your kitchen?        │  display
│  We'll only suggest meals       │  body, textMuted
│  you can actually cook.         │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🔲  Microwave only        │  │  ← 72pt tall cards
│  │     Dorm room basics      │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 🔲  Microwave + kettle    │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ✅  Full kitchen          │  │  ← selected: accent border
│  │     Stove and oven        │  │
│  └───────────────────────────┘  │
│                                 │
│  Anything else?                 │  heading
│  ( Air fryer )( Rice cooker )   │  ← toggle pills
│  ( Blender )( Toaster oven )    │
│                                 │
│  ┌───────────────────────────┐  │
│  │        Continue           │  │  accent, 56pt
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Interaction:** single-select tier, multi-select appliances. The subtitle under each tier does the explaining — no help text, no tooltip.

**Why this screen is first:** it is our third wedge and no competitor has it. Leading with it signals immediately that this app is different from the one the user just deleted.

### 3.2 Allergies & diet

Searchable list of common allergens plus dietary presets (vegetarian, vegan, halal, kosher, gluten-free). Free-text add for anything missing.

**Copy: "We'll never suggest a recipe with these. Promise."** Then keep it — this is a hard constraint that is never relaxed (Technical Spec §4.3).

Skippable, with a clear "Add later in settings."

### 3.3 Pantry starter

Pre-populated with assumed staples (salt, pepper, oil, flour, sugar, butter, eggs) shown as removable chips. Copy: **"We assumed you have these. Tap any you don't."**

Then the first capture prompt: **"Take a photo of your fridge"** — with a prominent camera button and a secondary "I'll add them manually" link.

This screen establishes the app's central interaction pattern — *tap to remove what's wrong* — before the user has any pantry worth breaking.

---

## 4. Home — the decision screen

The most important screen in the product. It exists to convert "I don't know what to eat" into three answers in under ten seconds.

```
┌─────────────────────────────────┐
│  Evening, RJ                    │  caption, textMuted
│                                 │
│  How much time                  │  display
│  do you have?                   │
│                                 │
│  ┌───────┐ ┌───────┐ ┌───────┐ │
│  │  15   │ │  30   │ │  60+  │ │  ← 96×96, radius lg
│  │  min  │ │  min  │ │  min  │ │
│  └───────┘ └───────┘ └───────┘ │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  🍽  Feeling like something?    │  caption — OPTIONAL, de-emphasized
│  ( Any )( Italian )( Asian ) →  │  ← horizontal scroll
│                                 │
│  ┌───────────────────────────┐  │
│  │      Show me meals        │  │  accent, 56pt
│  └───────────────────────────┘  │
│                                 │
│  📸 Update pantry · 24 items    │  caption, tappable
└─────────────────────────────────┘
```

**Design notes:**

- **Time is the only required input.** Everything else is optional and visually subordinate. This is the "time-first, not ingredient-first" wedge made literal in the layout.
- **Three time options, not a slider.** A slider is a decision. Three buttons are a reflex.
- Cuisine is optional, de-emphasized, and horizontally scrolled so it never competes with the primary action.
- Pantry count is visible but quiet — reassurance that the app knows what you have, without demanding management.
- **Tapping a time tile can go straight to results.** The "Show me meals" button is a fallback for users who expect it, not the required path. Fewer taps beats explicit confirmation here.

---

## 5. Results — the four buckets

```
┌─────────────────────────────────┐
│  ← 30 minutes                   │  ← tap to change
│                                 │
│  ✅ MAKE IT NOW                 │  heading, ready
│  ┌───────────────────────────┐  │
│  │ [img]  Chicken Fried Rice │  │  title
│  │        25 min · Stove     │  │  caption
│  │        You have it all    │  │  caption, ready
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ [img]  Microwave Mug Mac  │  │
│  │        8 min · Microwave  │  │
│  └───────────────────────────┘  │
│                                 │
│  🟡 MISSING A FEW               │  heading, near
│  ┌───────────────────────────┐  │
│  │ [img]  Beef Stroganoff    │  │
│  │        30 min · Stove     │  │
│  │        Need: sour cream,  │  │  ← chips, tappable
│  │              mushrooms    │  │
│  └───────────────────────────┘  │
│                                 │
│  ⚪ MISSING MORE          (3) ▾ │  ← collapsed by default
│  ⚪ GROCERY RUN           (8) ▾ │  ← collapsed by default
└─────────────────────────────────┘
```

### 5.1 Rules

- **Maximum 4 cards per bucket.** Truncation is the product. Adding a "show more" link inside the top buckets would rebuild the paralysis we exist to remove.
- **The bottom two buckets are collapsed by default.** They exist for completeness, not for browsing.
- **Every ingredient name anywhere is a chip**, and every chip is long-pressable for "I don't have this." This is the drift mitigation (R3) and it must be implemented as one shared `IngredientChip` component, never re-implemented per screen.
- **Every card shows required equipment.** Constant proof that the app respects the constraint the user declared.
- **Swipe left on a card to skip.** Records a `skipped` verdict — a weak negative signal, distinct from an explicit dislike.

### 5.2 Recipe source — visible, never emphasized

Recipes arrive from two tiers (Technical Spec §2.3). The user should never have to think about this, but attribution is contractually required for Tier 2.

- **Tier 1 (bundled):** no source badge. It's just a recipe.
- **Tier 2 (Spoonacular):** a small `caption`-sized source line on the card — *"via Simply Recipes"* — using the original publisher's name, not Spoonacular's. On the recipe page this becomes a tappable hyperlink to the source. **Required by their content terms at every tier.**
- **No "online/offline" indicator, no tier labels, no loading distinction.** Tier 2 results either arrive within the normal loading state or they don't exist. A user who never has quota simply sees a slightly shorter list, and is none the wiser.

### 5.3 Constraint relaxation — visible, never silent

When the top bucket is empty, the app relaxes a soft constraint and **says so, above the results:**

```
┌─────────────────────────────────┐
│  ┌───────────────────────────┐  │
│  │ ℹ️  Nothing fits 20 min.   │  │  surfaceAlt
│  │    Here's what works in   │  │
│  │    30. [ Keep 20 min ]    │  │  ← undo is always offered
│  └───────────────────────────┘  │
```

Relaxation order is fixed (Technical Spec §4.3): time → cuisine → escalate to Tier 2 → promote *missing a few* → widen to *missing more*. **Equipment, allergens, and dietary restrictions are never relaxed, and the banner never appears for them.**

**Tier escalation is the one silent step** — it adds options without removing constraints, so there is nothing to disclose and no banner.

**There is no empty state for this screen.** The bundled Tier 1 catalog ships inside the app, so an empty result is now structurally impossible. If the design ever calls for an empty state, the engine has a bug.

---

## 6. Recipe

```
┌─────────────────────────────────┐
│  [ hero image ]            ♡    │
│                                 │
│  Chicken Fried Rice             │  title
│  25 min · Stove · Chinese       │  caption
│                                 │
│  ┌───────────────────────────┐  │
│  │    👨‍🍳 Start cooking       │  │  accent, 56pt
│  └───────────────────────────┘  │
│                                 │
│  INGREDIENTS                    │  heading
│  ✓ Rice          2 cups         │  ← have: text
│  ✓ Chicken       200 g          │
│  ✗ Soy sauce     2 tbsp         │  ← missing: textMuted + strikethrough
│    [ I have this ]              │
│                                 │
│  STEPS                          │  heading
│  1. Heat oil in a wok...        │  body
│  2. Add the beaten eggs...      │
└─────────────────────────────────┘
```

Ingredients you have are checked and full-contrast; missing ones are muted with an inline "I have this" correction. **Drift correction runs in both directions** — the app is as wrong about what you lack as about what you have.

---

## 7. Cook Mode

Full-screen, one step at a time, designed for someone whose hands are dirty and whose phone is propped against a canister two feet away.

```
┌─────────────────────────────────┐
│  ✕                    Step 3/7  │
│                                 │
│                                 │
│   Add the beaten eggs and       │  cookStep — 28pt
│   scramble until just set,      │
│   about 90 seconds.             │
│                                 │
│              ┌─────────┐        │
│              │  1:30   │        │  ← timer when a step names a duration
│              │  ▶ Start│        │
│              └─────────┘        │
│                                 │
│                                 │
│  ┌────────┐  ┌───────────────┐ │
│  │   ←    │  │      →        │ │  ← 64×64 minimum
│  │  Back  │  │     Next      │ │
│  └────────┘  └───────────────┘ │
│                                 │
│         🎤  Tap to speak        │
└─────────────────────────────────┘
```

**Rules:**

- **Screen never sleeps** in cook mode (`expo-keep-awake`).
- **One step visible.** No scrolling — scrolling requires precision the user does not have.
- **Auto-timer** when a step contains a duration, parsed at catalog build time.
- **Voice is tap-to-listen for launch.** Wake-word is Phase 2 (Technical Spec §2.5). The mic button is enormous and reachable one-handed.
- Recognized commands: *"next" · "back" · "repeat" · "start timer."* Five words, no grammar to learn.
- **Step advances announce via `aria-live="polite"`.** Timer completion and allergen warnings — and nothing else — use `assertive`.

**Cook mode is the conditional feature.** If the August 9 gate fails, this screen becomes a plain scrollable recipe page and the decision is already made (Technical Spec §8).

### 7.1 Completion

On the final step, one question and nothing else:

```
        Did you like it?

     ┌────────┐  ┌────────┐
     │   👎   │  │   👍   │
     └────────┘  └────────┘

  We'll remove the ingredients
  you used from your pantry.
```

One tap, then out. No rating scale, no notes field, no share prompt. The user just cooked; they want to eat.

---

## 8. Pantry

Grouped by category (Produce, Protein, Dairy, Grains, Pantry staples). Each item is an `IngredientChip` with quantity and a remove affordance.

Two entry paths, always visible: **📸 Add by photo** (primary) and **＋ Add manually** (secondary).

Photo capture flow:

1. Camera opens; user may capture up to 10 shots in one session (fridge, freezer, two shelves).
2. Compress client-side to 640×640 before upload.
3. Processing state with honest copy: *"Reading your fridge..."*
4. **Confirmation sheet** listing detected items. Anything under 0.7 confidence is pre-flagged with a "Not sure about this one" marker.
5. User confirms or removes, then commits.

**Never write low-confidence items silently.** The confirmation sheet is what keeps a bad VLM read from poisoning the pantry — and the pantry is the product's memory.

---

## 9. Accessibility Requirements

These are Definition-of-Done gates, not polish. Full technical detail in Technical Spec §7.

| Requirement | Where it applies |
|---|---|
| `accessible={true}` focus grouping | Every recipe card — announced as one unit, not four fragments |
| `accessibilityLabel` | Every icon-only control. `♡` → `"Save recipe"` |
| `accessibilityHint` | Any non-obvious consequence. Chip → `"Removes this from your pantry"` |
| `accessibilityRole` | All interactive and structural elements |
| `aria-live="polite"` | Cook mode step changes, results updating after a drift correction |
| `aria-live="assertive"` | **Allergen warnings and expired timers only** |
| Reduced motion | Detect screen reader; disable auto-advance and decorative animation |
| Contrast | WCAG 2.1 AA — verified in the tokens above |
| Touch targets | 44pt standard, 64pt cook mode |
| Dynamic Type | Layouts reflow to 200%. Test before every release. |

**The cook mode case is the clearest argument for doing this well:** a sighted user with raw chicken on their hands has the same interaction problem as a blind user. The accessibility APIs solve both. This is not compliance overhead — it is the feature.

---

## 10. Copy Guidelines

The app's voice is a competent friend who cooks, not a brand.

| Do | Don't |
|---|---|
| "Nothing fits 20 min. Here's what works in 30." | "No results found for your search criteria." |
| "We assumed you have these. Tap any you don't." | "Default pantry items have been pre-populated." |
| "Reading your fridge..." | "Processing image. Please wait." |
| "You have it all" | "100% ingredient match" |
| "Take a photo of your fridge" | "Capture pantry inventory" |

**Rules:** second person. Contractions. Never blame the user. Never expose internals — no "confidence score," no "sync error." Under ten words wherever possible. And never an exclamation mark, except in the tagline.

---

## 11. Attribution & Offline States

Two requirements that come from Spoonacular's terms rather than from design.

### 11.1 Required attribution

| Where | What | Why |
|---|---|---|
| **Recipe card (Tier 2)** | *"via {publisher}"* in `caption`/`textMuted` | Content terms — credit the original source |
| **Recipe page (Tier 2)** | Publisher name as a tappable link to the original page, below the instructions | Content terms — must be a hyperlink |
| **About / Settings screen** | "Recipe data powered by [spoonacular](https://spoonacular.com/food-api)" | **Free-tier backlink requirement** |

The backlink goes on About/Settings, not the results screen. It satisfies the requirement without putting a competitor's brand on the screen our entire product thesis rests on.

**This ships before launch.** Missing attribution is a terms violation, and their access can be revoked without notice (Risk R11).

### 11.2 Saved Tier 2 recipe, opened offline

We may store a Spoonacular recipe's `id`, `title`, and `imageUrl` — but not its ingredients or instructions. So a saved Tier 2 recipe opened without a connection has a title and a picture and nothing else.

Handle it as a normal state, not an error:

```
┌─────────────────────────────────┐
│  [ hero image ]            ♡    │
│                                 │
│  Beef Stroganoff                │
│  Saved March 14                 │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 📶 Needs a connection to  │  │  surfaceAlt — not danger
│  │    load the full recipe.  │  │
│  │    [ Try again ]          │  │
│  └───────────────────────────┘  │
│                                 │
│  MAKE SOMETHING NOW             │  heading
│  ┌───────────────────────────┐  │
│  │ [img]  Mug Mac & Cheese   │  │  ← Tier 1, always works
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Always offer Tier 1 alternatives in the same view.** The rule holds: never a dead end.

Copy: *"Needs a connection to load the full recipe."* Not *"Failed to fetch"*, and not an explanation of caching policy.

---

## 12. Out of Scope for August 24

Named explicitly so nobody builds them by accident:

Shopping list · roommate/household sharing UI · expiry tracking and warnings · macro and nutrition goals · barcode scanning (**cut permanently, not deferred**) · wake-word voice · social sharing · recipe submission · meal planning calendar · servings scaling · dark mode toggle (follow the OS, do not offer a setting).

---

## 13. Implementation notes

Added after the first build of these screens. Where the code departs from the
text above, the reason is recorded here rather than left for someone to
rediscover.

### 13.1 The web build is the phone layout, letterboxed

There is one UI, shared by iOS, Android, and the web. On a browser it is
constrained to a 430pt centred column (`MobileViewport`, `layout.mobileViewportMaxWidth`)
with the page behind it painted `surfaceAlt`.

Left unbounded, the phone layout stretched to the full width of a monitor: the
summary tiles became 600pt wide and the ingredient chips spread into a single
sparse row. The alternative — a separate desktop layout — was rejected because
it would be a second design to keep in sync with no user asking for it. §0's
premise is a tired person holding a phone in one hand, and the browser build
exists to review that, not to replace it.

### 13.2 Deviations from the screens above

| Spec | Built | Why |
|---|---|---|
| §4 three time tiles: 15 / 30 / 60+ | Same, and "60+" means 60 | The engine's `TIME_TIERS` has a fourth tier at 120. It is reachable only by relaxation, which is what "+" denotes. |
| §4 cuisine chips | Curated shortlist of 8 | The catalog's cuisine values are not a vocabulary — 209 recipes have none, and the rest mix `british` with `france` and `netherlands`. Validated against the catalog at module load. |
| §3.2 searchable allergen list with free-text add | Eight fixed chips | Only allergen groups present in `ingredients.json` are offered. An allergen the vocabulary cannot detect is worse than an omitted one: it promises protection that does not exist. Sesame has no group and so is not listed. |
| §3.3 first photo capture | Built, optional | Offered on the staples screen and from the pantry tab. Never required — making a camera permission prompt the price of finishing setup contradicts "onboarding is a tax, keep it short". |
| §6 "Start cooking" | Present but disabled | Cook mode (§7) is not built. |
| §5.1 swipe left to skip | Not built | Deferred; `recordSkip` exists and the recipe screen records an explicit dislike. |

### 13.3 The one empty state, and why it is allowed

§5.3 says there is no empty state. That still holds for anything the app does
on its own: the relaxation ladder guarantees results.

The undo on the relaxation banner is the exception. Pressing "Keep 20 min" runs
`decide` instead of `decideWithRelaxation`, honouring the constraint exactly —
and that can legitimately return nothing. It is shown with an explanation and a
button back to the widened results. A user who explicitly asks for a narrower
filter and is told the filter is narrow has not hit a dead end; they have been
answered. An app that silently widens the filter instead is the failure §5.3 is
actually about.

---

*Application42 · HomeChef · UI/UX Specification v1.0 · August 3, 2026*
*§13 added August 9, 2026.*
