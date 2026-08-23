# HomeChef — UI/UX Specification

**Company:** Application42 · **Product:** HomeChef
**Version:** 0.1.0 · **Date:** August 8, 2026
**Scope:** August 24 MVP

**Current implementation:** Shared routes across native and responsive web;
onboarding uses equipment, restrictions, and staples; pantry scanning is
optional; Home exposes time and cuisine controls; results render all decision
buckets without relaxing hard constraints.

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

## 2. Screen inventory

| Route | Purpose |
|---|---|
| `(onboarding)/equipment` | Choose the equipment tier |
| `(onboarding)/restrictions` | Set dietary and allergen constraints |
| `(onboarding)/staples` | Seed pantry staples or open the optional scan |
| `(tabs)/index` | Choose time/cuisine and review the ranked buckets |
| `(tabs)/pantry` | Review, add, correct, and scan pantry items |
| `recipe/[id]` | Review ingredients and instructions |
| `cook/[id]` | Step-by-step cook mode |
| `scan` | Capture and confirm pantry candidates |
| `settings` | Product settings |

The tab routes are the current navigation contract. Responsive composition may
change with viewport width; product behavior and accessibility labels do not.

---

## 3. Onboarding

Onboarding asks only for launch-critical constraints:

1. choose an equipment tier;
2. select supported dietary and allergen restrictions;
3. accept starter staples, edit them, or optionally scan the pantry.

Camera access is never required to finish onboarding. Only allergen groups the
catalog can enforce may be offered. Every control uses design tokens, accessible
labels, and a single clear primary action.

---

## 4. Home and results

Home combines the decision inputs and result buckets on `(tabs)/index`.
Time choices are 15, 30, and 60+ minutes; the curated cuisine list is validated
against catalog values. Submitting produces at most four visible candidates per
bucket.

Buckets remain ordered from immediately cookable to larger pantry gaps. Hard
constraints—equipment, allergens, and dietary restrictions—are never relaxed.
Time and cuisine may relax in the documented engine order, with a visible
explanation and an undo path. Spoonacular may add options silently because it does not
remove a constraint.

Recipe source attribution is visible but secondary. A Spoonacular fetch failure or
quota response leaves the bundled catalog standing and never becomes a user-facing error.

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
└─────────────────────────────────┘
```

**Rules:**

- **One step visible.** No scrolling — scrolling requires precision the user does not have.
- **Auto-timer** when a step contains a duration, parsed at catalog build time.
- **Voice and keep-awake are deferred post-launch** (Technical Spec §2.5, decided
  Aug 22). Cook mode ships touch-only; the tap-to-listen mic button and the
  `expo-keep-awake` screen lock arrive with the voice release.
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
| "Nothing fits 20 min. Here's what works in 30." | "No results found for your search criteria." |
| "We assumed you have these. Tap any you don't." | "Default pantry items have been pre-populated." |
| "Reading your fridge..." | "Processing image. Please wait." |
| "You have it all" | "100% ingredient match" |
| "Take a photo of your fridge" | "Capture pantry inventory" |

**Rules:** second person. Contractions. Never blame the user. Never expose internals — no "confidence score," no "sync error." Under ten words wherever possible. And never an exclamation mark, except in the tagline.

---

## 11. Attribution & Network Failure States

Two requirements that come from vendor terms rather than from design.

### 11.1 Required attribution

| Where | What | Why |
|---|---|---|
| **Spoonacular recipe card** | *"via {publisher}"* in `caption`/`textMuted` | Content terms — credit the original source |
| **Spoonacular recipe page** | Publisher name as a tappable link to the original page, below the instructions | Content terms — must be a hyperlink |
| **About / Settings screen** | "Recipe data & images from [TheMealDB](https://www.themealdb.com)" | **Required by TheMealDB's paid terms** — see below |
| **About / Settings screen** | "Recipe data powered by [spoonacular](https://spoonacular.com/food-api)" | Free-plan backlink requirement — **only once a Spoonacular call actually ships** |

**TheMealDB attribution is the one that is currently required.** They supply 792
of the 812 bundled recipes and every recipe image. Their paid terms: *"You can
use our custom artwork in your projects but must mention us as the source of the
data"*, and artwork *"should link back to our website where appropriate."*

Spoonacular's backlink is conditional. The optional expansion is unimplemented as of Aug 12,
2026, and crediting a vendor that supplies zero recipes while omitting the one
that supplies all of them is worse than no attribution at all. Ship the
Spoonacular link with the first Spoonacular call, not before.

The backlinks go on About/Settings, not the results screen. That satisfies the
requirement without putting a competitor's brand on the screen our entire
product thesis rests on.

**This ships before launch.** Missing attribution is a terms violation, and their access can be revoked without notice (Risk R11).

### 11.2 Saved Spoonacular recipe, when the re-fetch fails

The app is online-only (Technical Spec §2.2.1), so sustained offline use is not a
supported state. But a request can still fail — dropped connection, vendor
outage, exhausted quota (HTTP 402) — and this screen is what the user sees when
it does.

We may store a Spoonacular recipe's `id`, `title`, and `imageUrl` — but not its
ingredients or instructions. So a saved Spoonacular recipe whose re-fetch fails has a
title and a picture and nothing else.

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
│  │ [img]  Mug Mac & Cheese   │  │  ← bundled catalog, always works
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Always offer bundled-catalog alternatives in the same view.** The rule holds: never a dead end.

Copy: *"Needs a connection to load the full recipe."* Not *"Failed to fetch"*, and not an explanation of caching policy.

---

## 12. Out of Scope for August 24

Named explicitly so nobody builds them by accident:

Shopping list · roommate/household sharing UI · expiry tracking and warnings · macro and nutrition goals · barcode scanning (**cut permanently, not deferred**) · wake-word voice · social sharing · recipe submission · meal planning calendar · servings scaling · dark mode toggle (follow the OS, do not offer a setting).

**Tab bar** — cut, not deferred. A tab bar puts a second decision on every screen
in an app whose entire thesis is removing decisions. Navigation is a stack; Home
reaches Pantry through one quiet row (§4).

---

## 13. Implementation notes

Added after the first build of these screens. Where the code departs from the
text above, the reason is recorded here rather than left for someone to
rediscover.

### 13.1 The web build is a responsive workspace — REVISED Aug 12, 2026

> **Retracted.** This section previously specified that the web build was the
> phone layout letterboxed into a 430pt column, and recorded that a separate
> desktop layout "was rejected." That decision was reversed. The text is
> replaced rather than amended because leaving it invited the letterbox back.

There is one UI, shared by iOS, Android, and the web, and one set of routes,
store state, engine behaviour, and accessibility labels. What changes across
viewports is composition, not functionality.

`getResponsiveLayout(width)` (`src/components/ui/responsive-layout.ts`) is the
single place a viewport width becomes a layout decision; `MobileViewport` and
`Screen` are its only consumers. Mobile stays a single-column, edge-to-edge
flow. Desktop renders a centred workspace capped near 1180pt with responsive
gutters and multi-column content, on a `surfaceAlt` page canvas.

Onboarding and cook mode stay focused single-column layouts at every width.
§0's premise — a tired person, one hand free — governs those two regardless of
how much room the browser has.

**Governing spec:** `docs/specs/2026-08-12-responsive-web-layout-design.md`.

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

*Application42 · HomeChef · UI/UX Specification v0.1.0 · August 3, 2026*
*§13 added August 9, 2026 · §13.1 retracted and rewritten August 12, 2026 ·
§7 voice and keep-awake deferred post-launch August 22, 2026.*
