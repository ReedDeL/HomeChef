# HomeChef — Technical Specification

**Company:** Application42
**Product:** HomeChef
**Version:** 1.0
**Date:** August 3, 2026
**Hard launch:** August 24, 2026 — **21 days out**
**Go / No-Go checkpoint:** August 9, 2026 — **6 days out**

**Owners:** RJ (CEO — business, product, project management, agentic engineering) · Harshal (CTO — software engineering, iOS, catalog pipeline) · third seat (TBD)

---

## 0. How to read this document

This is the binding technical decision record for HomeChef. Where this document conflicts with an earlier Notion page, **this document wins** and the Notion page should be updated to match. Three such conflicts are resolved explicitly in §2.6.

Every decision below is stated as: **what we chose**, **what we rejected**, and **why** — so that neither founder has to re-litigate it at 2am on August 20th.

---

## 1. Product Vision → Technical Constraints

The product is not a recipe search engine. It is a **decision engine**: it consumes constraints and emits three to four actionable directives. Every technical choice below descends from that framing.

| # | Business outcome (what the user experiences) | Technical constraint it forces |
|---|---|---|
| B1 | "I set up my kitchen once and it never asks again." | Durable per-user profile with equipment tier + allergens. Must survive reinstall → server-side, not device-local. Auth required from day one. |
| B2 | "I take a photo of my fridge and it knows what I have." | Open-vocabulary visual recognition. Cannot be a fixed-class model. Output must be machine-parseable, not prose. |
| B3 | "It shows me meals in four buckets by what I'm missing." | Set-difference of pantry against every recipe's ingredient list, computed for the entire catalog on every query. Must feel instant (<100ms perceived). |
| B4 | "Three good answers, not four hundred." | Ranking and truncation are product features. The engine must be *opinionated* — a scoring function, not a filter. |
| B5 | "I have 20 minutes." | `total_time_minutes` is a first-class indexed field, and the primary screen input. Not a settings-menu filter. |
| B6 | "Don't suggest a braise — I have a microwave." | Structured `equipment_required[]` on every recipe. **TheMealDB does not provide this** — we must synthesize it. This is the single largest data-engineering task in the build (§5.2). |
| B7 | "One tap to say I don't have this, from anywhere." | Every ingredient chip in the entire app is an interactive control bound to a single mutation. Enforced as a shared component, not a per-screen implementation. |
| B8 | "My roommate and I share a pantry, but not our allergies." | Relational model with row-level authorization. Inventory joins to a *household*; preferences and allergens join to a *user*. **This single requirement eliminates document databases.** |
| B9 | "Hands-free while cooking." | On-device speech, no per-request cloud billing, no network dependency mid-recipe. |
| B10 | "Never show me an empty screen." | Constraint relaxation is a required code path with its own tests — not an error state. |
| B11 | "Free forever, no subscription." | Infrastructure must be ~$0 at launch scale and sub-linear thereafter. Per-user recurring cloud cost is disqualifying. |
| B12 | ADA compliant. | Accessibility tree correctness is a Definition-of-Done gate, not a post-launch cleanup. |

### 1.1 The MVP line

The Notion vision defines the August 24 MVP narrowly, and we hold that line:

> User uploads an image of their fridge or pantry → app identifies ingredients → app returns meal suggestions the user can pick → recipe page opens.

**In scope for August 24:** onboarding (equipment + allergens), photo → pantry, manual pantry edit, time input, four-bucket results, recipe page, "I don't have this," like/dislike capture, auth, cross-device sync.

**Explicitly out of scope for August 24** (documented so nobody quietly builds them): barcode scanning (cut permanently), shopping list, roommate sharing UI, expiry tracking, macro/nutrition goals, wake-word voice, Spoonacular integration, ads infrastructure.

Cook mode voice is **conditional** — see the Aug 9 gate in §8.

---

## 2. Technology Stack

### 2.1 Client — React Native 0.86 + Expo 57 + TypeScript 6.0

**Chosen.** Confirmed against both the research document and the existing Notion `Technicalities` page.

Justification, in priority order for a 21-day build:

1. **One codebase, three targets.** iOS, Android, and web are all required by the vision. Three native codebases is not survivable by a three-person team in three weeks.
2. **The New Architecture removes the old objection.** Fabric + TurboModules + JSI give synchronous JS↔native calls. This matters concretely in exactly two places for us: camera frame handling during pantry capture, and speech-recognition callbacks in cook mode. Both were bridge-latency victims under the old architecture.
3. **Expo Config Plugins are the reason we can ship voice at all.** `@react-native-voice/voice` needs native `NSMicrophoneUsageDescription` and `RECORD_AUDIO` entries. Config plugins inject these during prebuild, so we never maintain a detached native project — which would cost us days we do not have.
4. **OTA updates are our safety net.** Expo pushes JS-bundle fixes directly to users, bypassing App Store review. With a hard external launch date, the ability to fix a launch-day bug in 20 minutes rather than 72 hours is not a nice-to-have.
5. **AI SDK ecosystem is JavaScript-first.** Every vendor ships a TS SDK before anything else.

*Closed: Flutter and separate native codebases were both evaluated and rejected. Do not reopen.*

| Layer | Choice | Version |
|---|---|---|
| Framework | Expo | 57 |
| Runtime | React Native / React | 0.86 / 19.2 |
| Language | TypeScript (`strict: true`) | 6.0 |
| Routing | expo-router (file-based, typed routes) | — |
| State — server | TanStack Query | v5 |
| State — client | Zustand | v5 |
| Recipe catalog | Bundled JSON, `src/data/` | — |
| Backend | Supabase | — |
| Voice | `@react-native-voice/voice` via config plugin | — |
| Editor | VS Code (shared workspace settings, committed) | — |

### 2.2 Backend — Supabase (managed PostgreSQL)

**Chosen.** Postgres, Auth, Row Level Security, Storage, and Edge Functions from one vendor, on one free tier.

**The deciding argument is B8, not cost.** The roommate requirement is a hard relational constraint: *inventory is shared, preferences are private, and both are queried in the same request.* Expressing that safely requires authorization enforced at the data layer.

Postgres RLS does this in the engine itself:

```sql
-- Pantry: visible to every member of the household.
create policy "household members read inventory"
on inventory for select
using (
  household_id in (
    select household_id from household_members
    where user_id = auth.uid()
  )
);

-- Preferences: visible only to their owner. Roommates never see these rows.
create policy "own preferences only"
on user_preferences for all
using (user_id = auth.uid());
```

A misconfigured client cannot leak a roommate's allergen list, because the database refuses to return the rows. That guarantee is worth more than any amount of application-layer discipline.

> **Closed: MongoDB and Firebase.** The Notion `Technicalities` page still lists "MongoDB/Firebase if needed" — that option is closed. A document store pushes the inventory/preferences join into application code, turning our privacy guarantee from an engine-enforced invariant into a code-review promise. Do not reopen; migrating databases mid-sprint is how launch dates get missed.

#### Cost model

| Resource | Free tier | Pro ($25/mo) | Overage |
|---|---|---|---|
| Monthly active users | 50,000 | 100,000 | $0.00325 |
| Database size | 500 MB | 8 GB | $0.125/GB |
| File storage | 1 GB | 100 GB | $0.021/GB |
| Network egress | 5 GB | 250 GB | **$0.09/GB** |
| Inactivity | Pauses after 7 days | Never pauses | — |

Two operational notes:

- **The free tier auto-pauses after 7 days of inactivity.** A paused project on demo day is a catastrophic and entirely avoidable failure. Either keep a scheduled ping alive or upgrade to Pro before any external demo. **Owner: RJ. Due: Aug 20.**
- **Egress is the metric that will bite us,** not user count. Recipe imagery is the driver. Mitigated in §2.3.

#### Edge Functions

All third-party API calls are brokered through Supabase Edge Functions (Deno/TypeScript). **The client never holds a third-party API key.** A key shipped in a mobile bundle is a public key.

Every Edge Function must handle the CORS preflight as its first statement, before any business logic — and must attach CORS headers to error responses too, otherwise a normal 500 surfaces on the client as an unrelated and deeply confusing CORS violation:

```ts
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const result = await handle(req);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // CORS headers on the error path too — non-negotiable.
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### 2.2.1 Authentication — Supabase Auth, federated sign-in

**DECIDED Aug 12, 2026.** Accounts are mandatory from first launch (B1: "I set up
my kitchen once and it never asks again" requires a durable server-side profile
that survives reinstall). Sign-in is **federated via Google**, brokered by
Supabase Auth.

Supabase Auth issues the JWT that every RLS policy in §3 keys on, so the
provider choice and the authorization model are the same decision. No custom
session handling, no second identity store.

**This is what makes the app online-only (§2.3.1).** A user cannot reach the
first screen without a network round trip to an identity provider, so designing
any downstream layer for offline operation protects a state that cannot occur.

**Open items — owner RJ:**

| Item | Why it matters |
|---|---|
| **Sign in with Apple** | Apple's App Store guidelines have historically required it wherever a third-party social login is offered. If that holds, iOS ships with both or is rejected at review. **Verify against current guidelines before the iOS build.** |
| **Email fallback** | A federated-only app locks out anyone without a Google account, and makes review-team testing awkward. Supabase magic links cost nothing to add. |
| **Session persistence** | Sessions must survive app restart, or "never asks again" fails on the second launch. |

### 2.3 Recipe catalog — two tiers, both free

**DECIDED Aug 3, 2026.** The catalog is a **two-tier hybrid**: TheMealDB bundled as a zero-cost, zero-latency floor, Spoonacular queried live for breadth. Both on free tiers. Total recurring cost: **$0.**

#### 2.3.1 Online-only — REVISED Aug 12, 2026

**The app requires a network connection. Offline support is not a requirement.**

Accounts are mandatory (B1) and sign-in is federated, so a user cannot reach the
app's first screen without connectivity. Designing the catalog around offline
capability was therefore protecting a state that cannot occur.

**What this changes:** offline access is no longer a reason to prefer bundled
data, and R12 (no offline access to Tier 2) is retired.

**What it does not change:** Tier 1 still exists, for reasons that were always
the stronger ones and were previously bundled under "offline" —

| Reason | Why it survives the change |
|---|---|
| **Zero marginal query cost** | Borrowed data bills per search, per user, forever |
| **<10ms ranking** | A remote round trip is ~300ms; the product promises fast answers |
| **We own hard-constraint enforcement** | Allergens are a safety path (§4.1). Our code, our tests — not a vendor's query parameter |
| **Vendor independence** | R11: third-party access can be revoked without notice |

The open question for scaling is no longer storability. It is whether a
candidate source's equipment metadata maps onto our closed nine-value enum
(§5.2) — see R13.

```
                    ┌─────────────────────────────────────┐
  User query  ──▶   │  TIER 1 — bundled MealDB (~300)     │  always available
                    │  instant · owned · no quota         │  <10ms · 0 cost
                    └──────────────┬──────────────────────┘
                                   │ buckets thin?
                                   │ quota available? online?
                    ┌──────────────▼──────────────────────┐
                    │  TIER 2 — Spoonacular live (380k+)  │  best-effort
                    │  online · ~300ms · nothing stored   │  50 pts/day
                    └─────────────────────────────────────┘
```

#### Tier 1 — TheMealDB, bundled at build time

~300 recipes with full instructions, measured ingredients, and images, pulled **once at build time** and shipped inside the app as JSON in `src/data/`.

- **No runtime API call** → no quota, no rate limit, no vendor outage
- **Zero marginal cost per query** → a search costs the same at 10 users and 10,000
- **Zero query latency** → the decision engine runs locally (§4), ranking in <10ms
- **We enforce our own hard constraints** → allergen and equipment filtering runs in
  tested code we own, not a vendor's query parameter (§4.1)

**This tier is why the app can never hard-fail.** It is the floor under every other decision in this document.

> **Images are hotlinked, not bundled.** All 792 TheMealDB recipes reference
> `themealdb.com` image URLs; `src/data/` ships JSON only. Acceptable under the
> online-only decision (§2.3.1), but it means recipe cards depend on TheMealDB's
> uptime and egress. The 20 hand-authored seed recipes have no images at all.

#### Tier 2 — Spoonacular, live query, nothing stored

380,000+ recipes with a **native `equipment` parameter** and native used/missing ingredient splitting. Queried live when Tier 1 returns thin results and quota and connectivity both allow.

**The binding constraint is legal, not technical.** From [Spoonacular's Terms of Use](https://spoonacular.com/food-api/terms):

> "You may not... copy or store the information it provides, **including any derived, hashed, or transformed data.** ... you may cache user-requested data... **for a maximum of 1 hour.**"
> "**Exempt:** You can indefinitely store the recipe id, the recipe title, and the recipe image url... you may not store any other data, including... ingredients, instructions, nutritional information."

**What this permits and forbids:**

| Action | Allowed |
|---|---|
| Fetch, compute over, and display ingredients and instructions in-session | ✅ |
| Hold results in memory ≤1 hour (session cache) | ✅ |
| Permanently store recipe **id, title, image URL** (saved meals, history) | ✅ |
| Persist ingredients or instructions to Postgres or the bundle | ❌ **Prohibited** |
| Run our equipment-enrichment pipeline over their recipes | ❌ **Prohibited** — "derived data" |
| Offline access to a Spoonacular recipe | ❌ Follows from the above |

> **The rule for every engineer and agent on this project: Spoonacular data is borrowed, not owned. Use it, render it, then let it go.** The only three fields that may touch our database are `id`, `title`, `imageUrl`.

#### Free-tier budget — the number that governs the design

| Plan | Cost | Quota |
|---|---|---|
| **Free** *(chosen)* | $0 | **50 points/day** · 1 req/s · backlink required |
| Academic/hackathon | $10/mo | ~5,000 req/day — *fallback if 50/day proves too tight* |

Point cost: `complexSearch` = **3 points + 0.01 per result.** Requesting 20 results ≈ **3.2 points**.

**50 ÷ 3.2 ≈ 15 Spoonacular-backed searches per day, across all users combined.**

That is a demo budget, not a production budget — and it is exactly why Tier 1 exists. Five mandatory mitigations:

1. **Single-call fetch.** `complexSearch` with `addRecipeInformation=true&fillIngredients=true` returns everything in one call. Never follow up with `Get Recipe Information` — that's a second point for data you already had.
2. **`number=20`, never 50.** Result points scale linearly and we only display 4 per bucket anyway.
3. **Session cache, 1 hour.** ToS-permitted, and it means re-running the same search costs nothing.
4. **Reserve budget.** Stop calling Spoonacular at 40 points used, holding ~10 points (≈3 searches) in reserve. Tier 1 covers everything after that.
5. **Read `X-API-Quota-Used` on every response.** Log it. When exhausted, Spoonacular returns **HTTP 402** — treat it as a normal degradation path, never as an error screen.

> ⏰ **Quota resets at midnight UTC = 5:00 PM Pacific.** An evening demo starts with a fresh 50 points. A morning demo inherits whatever yesterday's testing left behind. **Schedule demos after 5 PM Pacific.**

#### Attribution — required, not optional

- **Per-recipe source credit with a hyperlink** to the original site, on every Spoonacular recipe. Required by their content terms at every tier.
- **Backlink to Spoonacular's food API page**, required on the free tier. Placement: About/Settings screen (see UI spec §12).

*Closed: Edamam (no cooking instructions below $399/mo) and Calorie API (a nutrition database, not a recipe engine).*

> **Licensing action item.** TheMealDB's test key covers development and educational use. **A supporter payment is required before public App Store release.** Launch blocker with a dollar amount. **Owner: RJ. Due: Aug 17.**

### 2.4 Vision — Gemini 3.6 Flash with structured outputs

**Model string: `gemini-3.6-flash`** (stable). Called through a Supabase Edge Function.

> ⚠️ **Gemini 2.0 Flash is shut down** as of Google's 2026 deprecation cycle. Any tutorial, sample, or earlier draft referencing `gemini-2.0-flash` will fail. Use `gemini-3.6-flash`.

#### Why a cloud Vision-Language Model

The input is a photograph of a college refrigerator: dense occlusion, poor lighting, arbitrary orientation, generic packaging, and an **unbounded vocabulary** of possible ingredients. The output must be a database mutation, not a description.

An open-vocabulary VLM is the only approach that satisfies B2. It recognizes gochujang, tahini, or a half-used bag of frozen edamame with no training data from us — a fixed-class model returns nothing for these, silently, which is worse than an error. It accepts multiple images per prompt, so a user photographs the fridge, freezer, and two shelves in one flow and gets one merged pantry back. And it has zero fixed cost: nothing to train, nothing to host, which is what makes it compatible with free-forever (B11).

#### Model selection within the Gemini 3 family

| Model | Use |
|---|---|
| **`gemini-3.6-flash`** | **Chosen.** Latest stable. Balances speed and intelligence; strong multimodal performance. Direct successor to the 2.0 Flash role. |
| `gemini-3.5-flash-lite` | Cost/latency fallback if per-call spend becomes a problem at scale. Test before switching — pantry capture is accuracy-sensitive. |
| `gemini-3.5-flash` | Higher intelligence, higher cost. Only if 3.6 Flash proves insufficient on cluttered fridge photos. |

Pin the **stable** string, not `gemini-flash-latest`. The `latest` alias hot-swaps on every release with only two weeks' notice, which means our prompt and schema could silently start behaving differently mid-launch.

Google's **Interactions API** is now GA and is the recommended surface for new builds. Use it for this integration rather than the older endpoint.

**Accepted tradeoffs:** requires network connectivity (acceptable — the app is online-only by decision, §2.3.1); per-call cost scaling with usage (bounded — capture is infrequent, and this is the app's largest per-user variable cost); and a third-party dependency (mitigated — manual pantry entry is a complete fallback and is required anyway for B7).

**Phase 3 option:** once real user photos accumulate, a distilled on-device model could handle the ~200 most common ingredients locally and fall back to the cloud for the tail. A sound cost optimization, not a launch strategy.

#### Structured outputs are mandatory

The failure mode that would sink this integration is conversational output. If the model returns *"I can see an apple, some milk, and half a loaf of bread"*, we are writing a regex against an LLM — which is a bug generator, not an architecture.

We use **Controlled Generation**: an OpenAPI 3.0 JSON schema supplied in the request payload. The response is then guaranteed to conform to the exact keys, nesting, and types specified — with key ordering preserved and negligible added latency.

```ts
const INGREDIENT_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      name:       { type: "string",  description: "Generic ingredient type, never a brand" },
      quantity:   { type: "number" },
      unit:       { type: "string",  enum: ["grams", "milliliters", "pieces", "cups", "unknown"] },
      confidence: { type: "number",  description: "0.0 to 1.0" },
    },
    required: ["name", "quantity", "unit", "confidence"],
  },
} as const;
```

Two rules that follow from this schema:

- **`name` is normalized to ingredient TYPE, never brand** (vision requirement). "Chicken breast," not "Tyson Chicken Breast 3lb." Enforced in the prompt and validated against our canonical ingredient list on the way into the database.
- **`confidence` drives the UI.** Items below 0.7 are surfaced to the user for confirmation rather than silently written to the pantry. This is our primary defense against inventory drift originating at capture time.

Validate with **Zod** on the Edge Function before any write. The schema guarantee is strong but it is not a substitute for a boundary check — and Zod is where we catch a name that isn't in our canonical ingredient list.

### 2.5 Voice — on-device, native OS APIs

`@react-native-voice/voice` bridges to iOS `SFSpeechRecognizer` and Android `SpeechRecognizer`. Processing is local: no cloud cost, no per-request billing, no latency, works offline.

Requires native code, so it cannot run in the Expo Go sandbox — we use **Expo Prebuild + config plugins**, which generate the native projects during the build and inject the microphone permissions automatically.

**Wake-word ("Hey Chef") is deferred past launch.** Continuously streaming audio through the native recognizer is computationally expensive: it drains battery and causes thermal throttling during a long cooking session. The correct architecture is a dedicated on-device wake-word engine (Picovoice Porcupine) running a quantized network at milliwatt power, which then wakes the heavier recognition pipeline only on trigger. That is the right design — it is a Phase 2 build. **For August 24: tap-to-listen, with a large touch target sized for a knuckle or the back of a hand.**

### 2.6 Conflicts resolved

Three places where the sources disagreed, and the resolution:

| # | Conflict | Resolution |
|---|---|---|
| 1 | Brief states `PRIMARY_LANGUAGE: Python`; research and Notion both specify TypeScript/React Native. | **TypeScript is the product language.** Python is the *tooling* language and owns the catalog ingest and equipment-enrichment pipeline (§5.2) — a real, load-bearing component that plays directly to existing team fluency. Both standards are specified in the Style Guide. No Python enters the request path; adding a FastAPI layer would introduce a second deploy target for zero product benefit, 21 days from launch. |
| 2 | Notion `Technicalities` lists "MongoDB or Firebase if needed" alongside Supabase. | **Closed. Supabase Postgres only.** The roommate privacy requirement (B8) is a relational constraint enforced by RLS. Update the Notion page to remove the alternatives so nobody starts a parallel implementation. |
| 3 | Research recommends pgvector + Reciprocal Rank Fusion hybrid search; Notion specifies a bundled JSON catalog. | **Notion is right for launch.** Reasoning in §4.1 — at ~320 recipes the entire ranking runs client-side in under 10ms. Spoonacular doesn't change this: their terms forbid storing their recipes, so our *stored* catalog stays ~300 regardless of how many we display. |
| 4 | Original spec treated Spoonacular as a Phase 2 replacement whose data we would cache into Postgres. | **Wrong, and corrected Aug 3.** Their Terms of Use prohibit storing ingredients, instructions, or derived data beyond a 1-hour cache. Spoonacular is now Tier 2 — live query, nothing persisted but `id`/`title`/`imageUrl` (§2.3). |

---

## 3. Data Model

```sql
-- ---------- Identity and grouping ----------

create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  household_id  uuid not null references households(id),
  display_name  text,
  created_at    timestamptz not null default now()
);

create table household_members (
  household_id  uuid references households(id) on delete cascade,
  user_id       uuid references profiles(id)   on delete cascade,
  primary key (household_id, user_id)
);

-- ---------- Personal: never shared with roommates ----------

create table user_preferences (
  user_id           uuid primary key references profiles(id) on delete cascade,
  equipment         text[] not null default '{}',   -- ['microwave','kettle','air_fryer']
  allergens         text[] not null default '{}',
  dietary           text[] not null default '{}',   -- ['vegetarian','halal']
  onboarding_done   boolean not null default false,
  updated_at        timestamptz not null default now()
);

create table meal_feedback (
  user_id     uuid references profiles(id) on delete cascade,
  recipe_id   text not null,
  verdict     text not null check (verdict in ('liked','disliked','skipped')),
  made_on     date,
  created_at  timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

-- ---------- Shared: the household pantry ----------

create table inventory (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  ingredient_id  text not null,          -- FK into the bundled canonical ingredient list
  quantity       numeric,
  unit           text,
  purchased_on   date,
  source         text not null default 'manual'
                 check (source in ('manual','photo','staple','shopping_list')),
  added_by       uuid references profiles(id),
  updated_at     timestamptz not null default now(),
  unique (household_id, ingredient_id)   -- aggregate by TYPE, never by brand
);

create index inventory_household_idx on inventory (household_id);
```

**Recipes are not in Postgres.** Tier 1 is bundled JSON versioned with the app; Tier 2 is fetched live and discarded. The only recipe data that ever reaches Postgres is the `id`/`title`/`imageUrl` triple on `meal_feedback` and saved meals — see §2.3 for why that limit is contractual.

Three notes on the schema:

- The `unique (household_id, ingredient_id)` constraint enforces the vision's "aggregate by ingredient TYPE, not brand" rule at the database level. Adding a second carton of milk increments a quantity; it does not create a second row.
- `source` lets us measure which pantry-entry method users actually adopt — the highest-value analytics field we have for post-launch prioritization.
- `meal_feedback.verdict` includes `skipped`, distinct from `disliked`. A skip is a weak negative signal (suppress for a while); a dislike is a strong one (suppress similar recipes permanently).

**RLS is enabled on every table before any client code touches it.** Not a cleanup task.

---

## 4. The Decision Engine

### 4.1 The engine is a pure function over whatever recipes it is handed

**This is the design decision that makes the two-tier catalog work without compromising anything.**

`decide()` takes a `Recipe[]` and knows nothing about where those recipes came from. Tier 1 supplies them from a bundled import; Tier 2 supplies them from a live fetch. The engine cannot tell the difference and does not care.

```
  bundled MealDB JSON  ──┐
                         ├──▶  Recipe[]  ──▶  decide()  ──▶  ScoredRecipe[]
  Spoonacular fetch    ──┘                    ↑ pure, no I/O, no network
```

Two consequences worth stating plainly:

- **`src/engine/` stays pure and stays testable in milliseconds** with no device, no network, and no API quota. This is the entire reason our testing strategy survives the Spoonacular integration.
- **Merging tiers is trivial** — concatenate two arrays, deduplicate by title, hand the result to `decide()`. No second code path, no parallel ranking logic.

The research recommends pgvector semantic search fused via Reciprocal Rank Fusion. **At the scale we actually rank — ~300 bundled plus at most 20 fetched — that is over-engineering.** 320 recipes × ~10 ingredients = ~3,200 comparisons, **well under 10 milliseconds** on a phone.

The engine, unchanged from the original design:

```ts
type Bucket = "ready" | "missing_few" | "missing_some" | "grocery_run";

interface ScoredRecipe {
  recipe: Recipe;
  missing: Ingredient[];
  bucket: Bucket;
  score: number;
}

/**
 * Hard constraints eliminate; soft constraints rank.
 * Pure and synchronous — trivially unit-testable, which is why it is shaped this way.
 */
function decide(
  catalog: Recipe[],
  pantry: Set<IngredientId>,
  prefs: UserPreferences,
  timeLimit: Minutes,
): ScoredRecipe[] {
  const survivors = catalog.filter(
    (r) =>
      isEquipmentSatisfied(r.equipmentRequired, prefs.equipment) &&
      !hasAllergen(r, prefs.allergens) &&
      satisfiesDietary(r, prefs.dietary) &&
      r.totalTimeMinutes <= timeLimit,
  );

  return survivors
    .map((r) => scoreRecipe(r, pantry, prefs))
    .sort((a, b) => b.score - a.score);
}
```

**Hard constraints (eliminate — never softened):** equipment, allergens, dietary restrictions. An allergen leak is a safety incident. Recommending a braise to a microwave-only user destroys trust on first use, which is the wedge the whole product rests on.

**Soft constraints (rank — may be relaxed):** time, cuisine, ingredient coverage, disliked-similarity.

**Bucketing** by count of missing ingredients: `0` → *ready* · `1–2` → *missing a few* · `3–4` → *missing more* · `5+` → *grocery run*.

**Truncation is the product (B4).** Show at most 4 per bucket. Comprehensiveness is our competitors' value proposition, and it is the thing we are deliberately not doing.

### 4.2 The tier-2 escalation rule

Spoonacular is called **only** when all four conditions hold. Any one false → Tier 1 result stands, silently.

```ts
const shouldEscalate =
  tier1.ready.length < 3 &&        // bundled results are genuinely thin
  quotaUsedToday < 40 &&           // reserve ~10 points for the demo
  isOnline &&
  !sessionCache.has(queryKey);     // ToS-permitted 1-hour cache
```

The user is **never** told the app declined to call Spoonacular. There is no "quota exhausted" message, no degraded-mode banner. Tier 1 always has an answer, so from the user's side nothing happened.

### 4.3 Never show an empty screen (B10)

Relaxation is a first-class code path with its own test suite, not an error handler. Order is fixed and deliberate — cheapest concession first:

1. Expand the time limit by one tier (20 min → 30 min).
2. Drop the cuisine/genre preference.
3. **Escalate to Tier 2** if the §4.2 conditions allow.
4. Surface the *missing a few* bucket as the primary result.
5. Widen to *missing more*.

**Equipment, allergens, and dietary restrictions are never relaxed. Not at step 5, not ever.**

Every relaxation is stated out loud in the UI: *"Nothing fits 20 minutes — here's what works in 30."* Silent filter changes are how an app teaches a user not to trust it. **Tier escalation is the one exception** — it adds options without removing constraints, so there is nothing to disclose.

Because Tier 1 is bundled and always present, **an empty results screen is now structurally impossible.** If one ever appears, the bug is in the engine, not in the data.

### 4.4 Phase 2 — hybrid search, pre-designed

The trigger is a **stored** catalog above ~5,000 recipes. Spoonacular does not move this needle — their terms forbid storing their recipes, so our stored catalog stays at ~300 regardless of how many we display.

This becomes relevant only if we license a catalog we may keep, or accumulate enough user-submitted recipes. The design, so nobody has to invent it under pressure:

- Recipes move into Postgres with `pgvector` embeddings over ingredients, flavor profile, and cuisine.
- **Stage 1 — relational filter (hard constraints):** SQL `WHERE` purges anything violating equipment, allergens, dietary, or time. Runs *first*, non-negotiably — a purely semantic search will cheerfully suggest a braise to a microwave-only user on grounds of "conceptual similarity."
- **Stage 2 — semantic ranking:** HNSW approximate-nearest-neighbor over cosine distance between pantry and recipe ingredients.
- **Fusion:** Reciprocal Rank Fusion merges both rankings with a positional penalty.

---

## 5. Pipelines

### 5.1 Photo → pantry

```
Client                Edge Function            Gemini 3.6 Flash        Postgres
  |  1–10 images, compressed   |                        |                   |
  |--------------------------->|                        |                   |
  |                            | prompt + JSON schema   |                   |
  |                            |----------------------->|                   |
  |                            |   structured JSON      |                   |
  |                            |<-----------------------|                   |
  |                            | Zod validate           |                   |
  |                            | normalize → canonical ingredient ids       |
  |                            |------------------------------------------->|
  |   confirmation sheet       |                        |         upsert    |
  |<---------------------------|                        |                   |
```

Implementation requirements:

- **Compress client-side before upload.** Resize to 640×640 (the model's input size) and JPEG-encode at ~0.7 quality. Uploading a 12MP photo wastes the user's data and our egress allowance for zero accuracy gain.
- **Normalize to canonical ingredient IDs on the server.** The model returns free-text names; fuzzy-match against the bundled ingredient list and reject or flag anything unmatched. Without this step the pantry fills with near-duplicates ("scallion," "green onion," "spring onion") and the set-difference in §4.1 silently breaks.
- **Never write low-confidence items silently.** Anything under 0.7 goes into a confirmation sheet.
- **Upsert, never insert.** Enforced by the unique constraint; increments quantity on an existing row.

#### 5.1.1 Implementation notes (added August 10, 2026)

Three departures from the diagram above, each deliberate.

**Nothing is written before confirmation.** The diagram shows the Edge Function upserting to Postgres and *then* returning a confirmation sheet. Built the other way round: the function returns candidates, the user reviews and corrects them, and only the confirmed list is written. Correcting a misread after it has been stored means the user has to notice it later, which is exactly the drift (R3) the confirmation step exists to prevent. `confidence < 0.7` still drives which rows arrive pre-ticked.

**Normalization runs on the client, not the Edge Function.** §5.1's reason for putting it server-side is correctness of the canonical mapping, and that is preserved — it resolves against `src/data/ingredients.json`, the same bundled vocabulary the engine matches on. The client is the better seat for two reasons: correcting a name has to re-resolve instantly, so a server-side implementation would either make every keystroke a round trip or require a *second* normalizer on the client — and two normalizers that disagree is the precise failure §5.1 exists to prevent. Second, the vocabulary ships with the app, so a server normalizing against a newer list could return ids the running build has never heard of.

The mapping lives in `src/lib/ingredients/` (`normalize.ts`, `resolve.ts`, `candidates.ts`), is free of React, Expo, and Supabase imports for the same reason `src/engine/` is, and mirrors `tools/catalog/normalize.py`. A test asserts the two synonym tables stay identical.

**The response schema uses uppercase type names.** The `INGREDIENT_SCHEMA` printed in §2.4 spells types lowercase (`"array"`, `"string"`). Gemini's `responseSchema` is an OpenAPI subset carried over protobuf, whose JSON enum parsing is case-sensitive, so the values must be `ARRAY`, `OBJECT`, `STRING`, `NUMBER`. The shipped schema is otherwise identical to the spec.

**Matching tiers.** A name resolves through exact → synonym → plural → partial → fuzzy, and the tier is reported rather than collapsed, because the confirmation sheet's job is to show what the machine was unsure about. Only exact, synonym, and plural are auto-accepted. `partial` (qualifier words dropped, e.g. "baby spinach" → spinach) is never auto-accepted: the same mechanism turns "oat milk" into "milk", which is plausible, wrong, and precisely what poisons the pantry set difference.

### 5.2 Catalog build — Python, build-time, run once

**This is where Python lives, and it is genuinely load-bearing work — it produces the entire product catalog and closes our single largest data gap (B6).**

**Owner: Harshal. Due: August 9 (go/no-go gate).**

The pipeline is a Python package under `tools/catalog/`, run manually, whose output is committed to `src/data/`:

1. **Fetch** all ~300 recipes from TheMealDB.
2. **Normalize** ingredient strings to a canonical ID list. Deduplicate aggressively; this list is the shared vocabulary between the vision pipeline, the pantry, and the decision engine, so an error here propagates everywhere.
3. **Parse measurements** into `{quantity, unit}`. Expect messy input — "1 cup or so", "a pinch", "2 1/2 tbsp".
4. **Enrich equipment (the critical step).** TheMealDB carries no equipment metadata. Send each recipe's instruction text to an LLM with a strict JSON schema and extract `equipment_required: string[]` from a **closed enumeration** — `["microwave","stove","oven","air_fryer","kettle","blender","rice_cooker","toaster_oven","none"]`. A closed enum is what makes the §4.1 filter a simple set operation instead of a string-matching problem.
5. **Estimate `total_time_minutes`** from the instructions where absent.
6. **Human spot-check.** Sample 30 recipes and verify equipment tags by hand. This gate is mandatory — an oven-requiring recipe mislabeled `microwave` is precisely the trust-destroying failure the equipment wedge exists to prevent. **Log the sampled accuracy rate in the Notion status report.**
7. **Emit** `recipes.json` + `ingredients.json` to `src/data/`, and commit them.

Because this runs once at build time, its latency is irrelevant and its cost is a few dollars total. Python is the right tool: the team already writes it, and the ecosystem for this kind of messy-text ETL is unmatched.

> **This pipeline runs on TheMealDB recipes only.** Running it over Spoonacular data would produce "derived data," which their terms prohibit.
>
> ⚠️ **CORRECTED Aug 13, 2026.** This section previously claimed "Spoonacular
> supplies equipment natively via its `equipment` parameter, so there is nothing
> to enrich." That is **wrong**, and it was load-bearing for Tier 2. Their
> documented parameter is: *"The equipment required. **Multiple values will be
> interpreted as 'or'.** For example, value could be 'blender, frying pan,
> bowl'."*
>
> Three independent problems, in descending severity:
>
> 1. **OR semantics, not subset semantics.** Our constraint is
>    `recipe.equipmentRequired ⊆ user.equipment` (§4.1). Theirs is "uses at
>    least one of these." A microwave-only user querying `equipment=microwave`
>    gets back every recipe that touches a microwave at any step — including one
>    that also needs an oven. **The parameter cannot serve as our hard filter.**
> 2. **Open vocabulary, not a closed enum.** Returned values are free text
>    (`"pie form"`, `"bowl"`, `"frying pan"`). Our enum is nine fixed values, and
>    the closed enum is precisely what makes §4.1 a set operation rather than a
>    string-matching problem.
> 3. **Not in search results.** Equipment arrives via `analyzedInstructions` or a
>    per-recipe `equipmentWidget.json` call — not in `complexSearch` output — so
>    obtaining it costs either extra parameters or extra calls.
>
> **Consequence:** equipment for Tier 2 must be computed client-side, in-session,
> from `analyzedInstructions`, and run through our own `isEquipmentSatisfied`.
> That is permitted (compute and display in-session, persist nothing) but it
> means we cannot pre-filter, so we over-fetch and discard. See R13.

### 5.3 Spoonacular live query — Edge Function

```
Client              Edge Function                 Spoonacular
  |  pantry + prefs + time  |                          |
  |------------------------>|                          |
  |                         | check: thin? quota<40?   |
  |                         |   online? not cached?    |
  |                         |─────────┐                |
  |                         |  any false → return []   |
  |                         |<────────┘                |
  |                         |  complexSearch           |
  |                         |  &addRecipeInformation   |
  |                         |  &fillIngredients        |
  |                         |  &number=20              |
  |                         |------------------------->|
  |                         |   recipes + ingredients  |
  |                         |<-------------------------|
  |                         | read X-API-Quota-Used    |
  |                         | map → our Recipe type    |
  |   Recipe[] (in memory)  |                          |
  |<------------------------|                          |
  |                         |                          |
  |  merge with Tier 1 → decide() → render → DISCARD   |
```

Implementation requirements:

- **One call, everything in it.** `addRecipeInformation=true&fillIngredients=true`. A follow-up `Get Recipe Information` costs another point for data you already had.
- **`number=20`.** Result points scale linearly; we show 4 per bucket.
- **Map their shape to ours at the boundary.** Their `extendedIngredients[]`, `analyzedInstructions[]`, and `readyInMinutes` become our `Recipe` type inside the Edge Function, so the engine sees one shape regardless of source.
- **Persist nothing but `id`, `title`, `imageUrl`.** Enforce this in code with an explicit whitelist on the way to Postgres, not by convention. A reviewer should be able to grep for it.
- **HTTP 402 is a normal outcome.** Return an empty array and let Tier 1 stand. Never surface it as an error.
- **Log `X-API-Quota-Used`** to a counter so the reserve rule in §4.2 has real data.
- **Session cache keyed on the query, 1-hour TTL**, in memory. Never written to disk or Postgres.

---

## 6. Security and Privacy

| Control | Implementation |
|---|---|
| Third-party API keys | Supabase secrets, referenced only inside Edge Functions. **Never in the client bundle, never in git.** Full setup: `06_API_KEYS_AND_ENV.md`. |
| Spoonacular data retention | Whitelist enforced in code — only `id`, `title`, `imageUrl` may reach Postgres. Ingredients and instructions are session-scoped and discarded. |
| Data authorization | RLS on every table, enabled before client integration. |
| Roommate privacy | Preferences, allergens, and feedback join to `user_id`. Structurally unreachable by household members. |
| Photo retention | Images are processed and discarded. We store extracted ingredients, not photographs. Simplest possible privacy posture, and the easiest to explain to a user. |
| Auth | Supabase Auth. Email + Apple Sign-In (Apple Sign-In is an App Store requirement if any other social login is offered). |
| Transport | TLS throughout; certificate pinning deferred to post-launch. |
| Secret scanning | GitHub push protection enabled on the repository. |

**Allergen handling is a safety feature, not a filter.** It is a hard constraint (§4.3), it is never relaxed, and any change to allergen-filtering code requires review from both founders. This is the one place in the codebase where we deliberately accept slower velocity.

---

## 7. Accessibility (ADA) — a Definition-of-Done gate

Accessibility work here does double duty: the same APIs that serve screen-reader users also solve the **situational disability** at the heart of cook mode — a user whose hands are covered in raw chicken cannot reliably touch a screen either.

| Requirement | Implementation |
|---|---|
| Focus grouping | `accessible={true}` on every recipe card, so a screen reader announces the card as one unit rather than reading icon → title → time → count as four disjointed fragments. |
| Descriptive labels | `accessibilityLabel` on every icon-only control. The save-heart declares `"Save recipe"`, never an image filename. |
| Contextual hints | `accessibilityHint` on any control with a non-obvious consequence — e.g. `"Removes this ingredient from your pantry"`. |
| Semantic roles | `accessibilityRole` on all interactive and structural elements, so the OS appends its native affordance ("double tap to activate"). |
| Live regions — polite | `aria-live="polite"` for cook-mode step advances. Announces after the current utterance finishes. |
| Live regions — assertive | `aria-live="assertive"` **reserved exclusively for allergen warnings and expired timers.** Overuse makes the app hostile to screen-reader users. |
| Reduced motion | `AccessibilityInfo.isScreenReaderEnabled()` to disable auto-advancing carousels and decorative animation. |
| Contrast | WCAG 2.1 AA — 4.5:1 body text, 3:1 large text. Verified in the design tokens (see UI/UX spec). |
| Touch targets | Minimum 44×44pt. Cook-mode controls minimum **64×64pt** — sized for a knuckle. |
| Audit | Xcode Accessibility Inspector and Android Accessibility Scanner run before every release. |

---

## 8. Risk Register

| # | Risk | Severity | Mitigation | Owner |
|---|---|---|---|---|
| R1 | **Catalog thinness.** ~300 bundled recipes produce thin results for constrained pantries and microwave-only users. | Medium *(was High)* | **Largely mitigated by Tier 2.** Spoonacular adds 380k recipes when quota allows. Aug 9 gate still tests three real dorm pantries against Tier 1 alone — Tier 1 must stand on its own, because Tier 2 is best-effort. | RJ |
| R2 | **Equipment metadata gap** in TheMealDB. | Medium *(was High)* | LLM enrichment pipeline (§5.2) for Tier 1, with a mandatory 30-recipe human spot-check. ~~Tier 2 supplies equipment natively.~~ **Corrected Aug 13, 2026 — it does not; see R13.** | Harshal |
| R10 | **Spoonacular quota exhaustion.** 50 points/day ≈ 15 searches total. A tester burning quota an hour before a demo. | **High** | Reserve rule (stop at 40 points), session cache, `number=20`, single-call fetch. **Tier 1 makes exhaustion invisible to users.** Demos scheduled after 5 PM Pacific, when quota resets. | Harshal |
| R11 | **Spoonacular ToS violation** — storing ingredients or instructions, or running enrichment over their data, would breach terms and can revoke access without notice. | **High** | Explicit field whitelist (`id`, `title`, `imageUrl`) enforced in code, not convention. Code review checks every Spoonacular write path. Attribution and backlink shipped before launch. | Harshal |
| R12 | ~~No offline access to Tier 2 recipes.~~ **RETIRED Aug 12, 2026** — the app is online-only (§2.3.1), so this state cannot occur. Saved meals still store only `id`/`title`/`imageUrl` and re-fetch on open. | — | — | Harshal |
| R13 | **Tier 2 equipment cannot be filtered server-side.** CONFIRMED Aug 13, 2026 from Spoonacular's docs (§5.2). Their `equipment` parameter is OR-semantics over an open vocabulary and is absent from search results, so it cannot enforce our hard constraint. | **High — realized, not hypothetical** | Do not use their `equipment` parameter as a filter. Any Tier 2 integration must extract equipment from `analyzedInstructions` in-session, map it to our nine-value enum, and enforce with our own `isEquipmentSatisfied`. Accept the over-fetch. **Until that is built and tested, Tier 2 cannot ship** — §4.1 forbids relaxing equipment, and shipping unverified equipment would relax it silently. | RJ |
| R3 | **Inventory drift.** Pantry desynchronizes from reality; recommendations rot; users disengage. | **High** | One-tap "I don't have this" on every ingredient chip app-wide, enforced via a single shared component. Confidence threshold at capture. | Harshal |
| R4 | **TheMealDB licensing.** Supporter payment required before public App Store release. | **High** | Pay by **Aug 17**. Hard blocker with a dollar amount. | RJ |
| R5 | **Supabase free-tier auto-pause** after 7 days idle — a dead demo. | Medium | Scheduled keep-alive ping, or upgrade to Pro before any external demo. Due Aug 20. | RJ |
| R6 | **App Store review latency.** Review can exceed the remaining runway. | **High** | Submit by **Aug 17** at the latest. Ship web first — it has no review gate — and treat iOS approval as a follow-on. | RJ |
| R7 | **Voice scope creep.** Cook mode expands and eats the schedule. | Medium | Pre-committed cut: if cook mode is not working by Aug 9, it becomes a plain scrollable recipe page. This decision is already made. | Both |
| R8 | **VLM misclassification** damaging first-run trust. | Medium | Confidence threshold ≥0.7 for silent writes; confirmation sheet below it; manual entry always available. | Harshal |
| R9 | **Egress overage** from recipe imagery. | Low | Images bundled or CDN-served, never proxied through Supabase. Client-side compression on upload. | Harshal |

### The August 9 Go / No-Go

**The test:** a realistic dorm pantry returns correctly bucketed, equipment-appropriate recipes.

- **GO** → build cook mode with voice.
- **NO-GO** → cut cook mode to a plain scrollable recipe page and **protect the August 24 date.**

This decision is pre-committed. It is written down now precisely so that it is not re-argued on August 9, when everyone is tired and attached to the work.

---

## 9. Repository Layout

```
homechef/
├── app/                       # expo-router — file-based routes
│   ├── (onboarding)/          #   equipment, allergens, staples
│   ├── (tabs)/                #   home (time input), pantry, saved
│   ├── recipe/[id].tsx
│   └── cook/[id].tsx
├── src/
│   ├── components/            # shared UI; IngredientChip lives here
│   ├── engine/                # decide(), scoring, bucketing, relaxation — pure, no I/O
│   ├── data/                  # recipes.json, ingredients.json (generated — do not hand-edit)
│   ├── lib/                   # supabase client, query hooks
│   ├── stores/                # zustand
│   └── types/
├── supabase/
│   ├── functions/
│   │   ├── _shared/cors.ts
│   │   └── analyze-pantry-photo/
│   └── migrations/
├── tools/
│   └── catalog/               # Python: TheMealDB ingest + equipment enrichment
│       ├── pyproject.toml
│       └── src/catalog/
├── docs/                      # this specification and its companions
├── AGENTS.md                  # agent context for the repo
└── app.json
```

**`src/engine/` has no imports from `src/lib/` or React.** It is a pure function over plain data. This is the one architectural rule worth defending in code review, because it is what makes the core product logic testable in milliseconds without a device, a network, or a database.

---

## 10. Companion Documents

| Document | Contents |
|---|---|
| `02_STYLE_GUIDE.md` | TypeScript and PEP 8 standards, comment policy, Git commit conventions |
| `03_COLLABORATION_BLUEPRINT.md` | GitHub Flow, Notion board, Definition of Done, role boundaries |
| `04_UIUX_SPEC.md` | Screen inventory, design tokens, interaction rules |
| `05_AI_TOOLING_PLAYBOOK.md` | How the team uses AI tools without generating slop |
| `AGENTS.md` | Repo-root context file consumed by coding agents |

---

*Application42 · HomeChef · Technical Specification v1.0 · August 3, 2026*
