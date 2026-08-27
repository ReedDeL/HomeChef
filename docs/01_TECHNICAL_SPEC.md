# HomeChef — Technical Specification

**Company:** Application42
**Product:** HomeChef
**Version:** 0.1.1 · **Updated:** August 27, 2026
**Scope:** August 24 MVP. Current implementation status lives in ../README.md.

---

## 0. How to read this document

This is the binding technical decision record for HomeChef. Its decisions supersede earlier planning notes. Three such conflicts are resolved explicitly in §2.6.

Every decision below is stated as: **what we chose**, **what we rejected**, and **why** — so that neither founder has to re-litigate it at 2am on August 20th.

---

## 1. Product Vision → Technical Constraints

The product is not a recipe search engine. It is a **decision engine**: it consumes constraints and emits three to four actionable directives. Every technical choice below descends from that framing.

| # | Business outcome (what the user experiences) | Technical constraint it forces |
|---|---|---|
| B1 | "I set up my kitchen once and it never asks again." | Durable local profile with equipment tier + allergens. An optional sync account adds cross-device recovery without delaying first use. |
| B2 | "I take a photo of my fridge and it knows what I have." | Open-vocabulary visual recognition. Cannot be a fixed-class model. Output must be machine-parseable, not prose. |
| B3 | "It shows me meals in four buckets by what I'm missing." | Set-difference of pantry against every recipe's ingredient list, computed for the entire catalog on every query. Must feel instant (<100ms perceived). |
| B4 | "Three good answers, not four hundred." | Ranking and truncation are product features. The engine must be *opinionated* — a scoring function, not a filter. |
| B5 | "I have 20 minutes." | `total_time_minutes` is a first-class indexed field, and the primary screen input. Not a settings-menu filter. |
| B6 | "Don't suggest a braise — I have a microwave." | Structured `equipment_required[]` on every accepted recipe. Source data is evidence, not permission to guess: unknown equipment excludes. This remains the catalog's highest-risk enrichment gate (§5.2). |
| B7 | "One tap to say I don't have this, from anywhere." | Every ingredient chip in the entire app is an interactive control bound to a single mutation. Enforced as a shared component, not a per-screen implementation. |
| B8 | "My roommate and I share a pantry, but not our allergies." | Relational model with row-level authorization. Inventory joins to a *household*; preferences and allergens join to a *user*. **This single requirement eliminates document databases.** |
| B9 | "Hands-free while cooking." | On-device speech, no per-request cloud billing, no network dependency mid-recipe. |
| B10 | "Never show me an empty screen." | Constraint relaxation is a required code path with its own tests — not an error state. |
| B11 | "Free forever, no subscription." | Infrastructure must be ~$0 at launch scale and sub-linear thereafter. Per-user recurring cloud cost is disqualifying. |
| B12 | ADA compliant. | Accessibility tree correctness is a Definition-of-Done gate, not a post-launch cleanup. |

### 1.1 The MVP line

The launch product accepts kitchen constraints and a pantry scan, renders a
small set of equipment-, allergen-, and diet-compatible options from the curated
offline catalog, and can add bounded candidates from the active hosted release.
Shopping lists, barcode scanning, macro tracking, wake-word voice, and
roommate-sharing UI are out of scope.

---

## 2. Technology Stack

### 2.1 Client — React Native 0.86 + Expo 57 + TypeScript 6.0

**Chosen.** Confirmed against the research document and the current architecture record.

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
| Recipe catalog | Protected Supabase release + curated offline JSON | — |
| Backend | Supabase | — |
| Voice | Deferred post-launch (§2.5) | — |
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

> **Closed: MongoDB and Firebase.** Supabase Postgres is the only database for launch. The roommate privacy requirement is a relational constraint enforced by RLS; do not reopen the alternatives.

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

### 2.2.1 Authentication — local by default, optional sync identity

**REVISED Aug 27, 2026.** HomeChef creates a local account by default. Equipment
onboarding is the first action; no identity-provider or network round trip may
stand between launch and the local decision engine.

Google sign-in through Supabase Auth is an optional choice whose sole product
purpose is cross-device sync and recovery. Supabase Auth issues the JWT used by
the RLS policies in §3, so synced data retains the same household and personal
privacy boundaries. Signing out stops sync but never deletes the local kitchen.

The Zustand store remains the source of truth for unsigned users. A sync layer
must reconcile that state through the existing TanStack Query/Supabase seam:
first sign-in uploads meaningful local state before empty server defaults can
replace it, and subsequent devices pull the authenticated profile. Sync failure
falls back to local state without blocking the app.

**Open items — owner RJ:**

| Item | Why it matters |
|---|---|
| **Sign in with Apple** | Apple's App Store guidelines have historically required it wherever a third-party social login is offered. If that holds, iOS ships with both or is rejected at review. **Verify against current guidelines before the iOS build.** |
| **Email fallback** | A federated-only app locks out anyone without a Google account, and makes review-team testing awkward. Supabase magic links cost nothing to add. |
| **Sync reconciliation** | First sign-in must preserve meaningful local data; later devices need deterministic conflict handling instead of last-response-wins replacement. |

### 2.3 Recipe sources — rights-first hosted catalog and offline fallback

**The release catalog is source-neutral and auditable.** `tools/catalog/`
accepts only approved, checksum-pinned neutral JSONL with complete license and
attribution metadata. Candidate sources are research records and cannot enter a
release.

**The client is offline-first.** A curated release subset ships with the app and
renders before network work. The current provider-derived bundle is a
transitional fallback, not an approved rebuild source, and remains only until
replacement parity is documented.

**Supabase hosts the full active release.** Authenticated, bounded RPCs expose
candidate summaries, recipe details, and active attribution. Clients have no
direct catalog writes, the full hosted catalog never enters the Metro bundle,
and hosted failure leaves the offline answers intact.

Catalog counts are operational release evidence, not architecture. See the
owned catalog design and roadmap for the current gate.

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

**Accepted tradeoffs:** photo analysis requires network connectivity, while manual pantry entry and the bundled decision engine remain the complete local fallback; per-call cost scales with usage (bounded — capture is infrequent and is the app's largest per-user variable cost); and a third-party dependency is mitigated by the required manual correction path (B7).

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

> **DEFERRED post-launch (decided Aug 22, 2026).** All voice interaction —
> tap-to-listen included — is out of the August 24 build. The architecture
> below is the design we will implement when voice returns.

`@react-native-voice/voice` bridges to iOS `SFSpeechRecognizer` and Android `SpeechRecognizer`. Processing is local: no cloud cost, no per-request billing, no latency, works offline.

Requires native code, so it cannot run in the Expo Go sandbox — we use **Expo Prebuild + config plugins**, which generate the native projects during the build and inject the microphone permissions automatically.

**Wake-word ("Hey Chef") and tap-to-listen are both deferred.** Wake-word continuously streams audio through the native recognizer, which drains battery and causes thermal throttling during a long cooking session; it wants a dedicated on-device engine (Picovoice Porcupine) and is a Phase 2 build. Tap-to-listen was scoped for launch but cut two days out: untestable in CI, device-dependent, and half-shipped voice is worse than none. Cook mode ships silent; step navigation stays touch-first.

### 2.6 Conflicts resolved

Four places where the sources disagreed, and the resolution:

| # | Conflict | Resolution |
|---|---|---|
| 1 | Brief states `PRIMARY_LANGUAGE: Python`; research and earlier planning record both specify TypeScript/React Native. | **TypeScript is the product language.** Python is the build-time catalog tooling language (§5.2). No Python enters the request path. |
| 2 | Earlier planning listed MongoDB or Firebase alongside Supabase. | **Closed. Supabase Postgres only.** Household privacy is relational and enforced by RLS. |
| 3 | Research recommends pgvector and hybrid search. | **Rejected for this product path.** Supabase returns bounded candidates and the pure client engine applies hard constraints, ranking, and truncation. |
| 4 | Earlier revisions used a live recipe provider and called the bundled provider data owned. | **Retired Aug 27.** New releases require approved, checksum-pinned sources with auditable rights. The old bundle is transitional until replacement parity, not an ownership claim. |

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

**Recipes are stored in protected release tables.** Clients read only the active release through bounded authenticated RPCs; RLS and grants deny direct writes. A curated subset is versioned with the app so catalog access remains useful offline. Release activation is an explicit, auditable operation.

Three notes on the schema:

- The `unique (household_id, ingredient_id)` constraint enforces the vision's "aggregate by ingredient TYPE, not brand" rule at the database level. Adding a second carton of milk increments a quantity; it does not create a second row.
- `source` lets us measure which pantry-entry method users actually adopt — the highest-value analytics field we have for post-launch prioritization.
- `meal_feedback.verdict` includes `skipped`, distinct from `disliked`. A skip is a weak negative signal (suppress for a while); a dislike is a strong one (suppress similar recipes permanently).

**RLS is enabled on every table before any client code touches it.** Not a cleanup task.

---

## 4. The Decision Engine

### 4.1 The engine is a pure function over whatever recipes it is handed

This boundary makes hosted and offline catalog data interchangeable without
moving network or storage concerns into ranking.

`decide()` takes a `Recipe[]` and does not know whether a recipe came from the
curated offline subset, a bounded hosted response, or a deterministic test
fixture.

```text
curated offline subset ──┐
                         ├──▶ Recipe[] ──▶ decide() ──▶ ScoredRecipe[]
bounded hosted results ──┘                  ↑ pure, no I/O, no network
```

Two consequences matter:

- `src/engine/` stays pure and testable in milliseconds.
- Hosted candidates are mapped to the same contract, deduplicated, and passed
  through the same hard constraints before ranking.

At the bounded candidate sizes HomeChef displays, client-side set operations are
simpler and safer than vector search. Catalog scale belongs behind the hosted
RPC boundary, not inside the client bundle.

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

### 4.2 Hosted catalog enrichment

Offline results are computed first. When an authenticated hosted catalog is
available, the client may request a bounded candidate set for the same hard
constraints, map it to `Recipe[]`, deduplicate it against the offline subset,
and rerun the pure engine.

The hosted response is untrusted input: unknown equipment, allergen, or dietary
status still excludes locally. Timeout, auth failure, missing active release, or
an empty response leaves the offline result unchanged and produces no
provider-specific UI.

### 4.3 Never show an empty screen (B10)

Relaxation is a first-class code path with its own test suite, not an error
handler. Order is fixed and deliberate — cheapest concession first:

1. Expand the time limit by one tier (20 min → 30 min).
2. Drop the cuisine/genre preference.
3. Merge bounded hosted candidates when available.
4. Surface the *missing a few* bucket as the primary result.
5. Widen to *missing more*.

Equipment, allergens, and dietary restrictions are never relaxed. Hosted
enrichment adds candidates but does not remove constraints, so it needs no
relaxation disclosure. Every actual relaxation is stated in the UI.

The curated offline subset is the safety floor. If the hosted catalog fails, the
same offline decision path still returns useful answers.

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

**The response schema uses standard JSON Schema type names.** An earlier
implementation on the legacy `generateContent` endpoint required UPPERCASE
proto enum names (`ARRAY`, `OBJECT`) because its `responseSchema` was carried
over protobuf with case-sensitive enum parsing. The Interactions API takes a
plain JSON Schema in `response_format.schema`, and the vendor's examples are
lowercase throughout, so the shipped schema matches §2.4 exactly again.

**Matching tiers.** A name resolves through exact → synonym → plural → partial → fuzzy, and the tier is reported rather than collapsed, because the confirmation sheet's job is to show what the machine was unsure about. Only exact, synonym, and plural are auto-accepted. `partial` (qualifier words dropped, e.g. "baby spinach" → spinach) is never auto-accepted: the same mechanism turns "oat milk" into "milk", which is plausible, wrong, and precisely what poisons the pantry set difference.

### 5.2 Catalog build — Python, build-time

Python owns the reproducible catalog maintenance path under `tools/catalog/`.
It does not run in the request path.

1. **Register candidates.** Record source, version, license, attribution,
   archive format, and the work needed before approval. Candidate status is
   never release-eligible.
2. **Pin provenance.** Resolve an immutable upstream artifact and independently
   verify its SHA-256.
3. **Extract neutral JSONL.** Source-specific code emits the shared record
   contract with stable IDs and page-level provenance. Raw provider or wiki
   formats stop at this boundary.
4. **Normalize and quarantine.** Canonicalize ingredients and measurements,
   classify equipment/allergen/dietary evidence, and reject unsafe or malformed
   rows with counted reasons. Unknown hard constraints exclude.
5. **Build deterministically.** Sort and serialize a release artifact plus a
   curated offline subset. The same inputs must produce the same checksums.
6. **Review.** Inspect source counts, rejection reasons, attribution, hard-
   constraint coverage, and useful-answer parity. Human spot-checks are
   mandatory.
7. **Load, then activate.** Load into protected Supabase release tables and
   activate through the audited function only after every gate passes.

The transitional provider-derived bundle is not overwritten until an approved
release meets the documented parity and legal gates.

### 5.3 Hosted catalog reads

```text
Client                 Supabase protected catalog
  | offline decide()              |
  |----------------> render       |
  |                               |
  | bounded candidate RPC         |
  |------------------------------>|
  | summaries + release id        |
  |<------------------------------|
  | map + hard constraints        |
  | merge + decide() -> render    |
  |                               |
  | detail/attribution RPC on use |
  |------------------------------>|
```

The client cannot enumerate or mutate release tables directly. Candidate,
detail, and attribution RPCs are authenticated, bounded, and pinned to the
active release. A failed hosted call leaves the already-rendered offline result
standing.

---

## 6. Security and Privacy

| Control | Implementation |
|---|---|
| Third-party API keys | Supabase secrets, referenced only inside Edge Functions. **Never in the client bundle, never in git.** Full setup: `06_API_KEYS_AND_ENV.md`. |
| Catalog release integrity | Approved checksum-pinned sources only; protected tables deny direct client writes; activation is audited. |
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

## 8. Current risks

Live status and measured catalog gaps belong in `README.md#known-gaps`.
Architecture-level risks that remain binding are:

- candidate source research can be mistaken for release approval;
- parser or enrichment gaps can silently reduce useful hard-constraint coverage;
- the hosted catalog must fail back to a useful curated offline subset;
- replacement parity and attribution must be proven before retiring the
  transitional bundle;
- live Gemini request compatibility requires a post-deploy smoke test;
- every personal-data and catalog table requires RLS, grants, and
  authenticated-session verification.

---

## 9. Repository layout

The live tree is the source of truth. The stable boundaries are:

- `app/`: Expo Router screens;
- `src/engine/`: pure decision logic;
- `src/lib/`: I/O, adapters, and service boundaries;
- `src/data/`: generated bundled catalog;
- `supabase/`: migrations and Edge Functions;
- `tools/catalog/`: build-time Python tooling.

See `../README.md` for current routes and commands.

---

## 10. Companion Documents

| Document | Contents |
|---|---|
| `02_STYLE_GUIDE.md` | TypeScript and PEP 8 standards, comment policy, Git commit conventions |
| `03_COLLABORATION_BLUEPRINT.md` | GitHub Flow, earlier planning record board, Definition of Done, role boundaries |
| `04_UIUX_SPEC.md` | Screen inventory, design tokens, interaction rules |
| `CONTRIBUTING.md` | Team setup, branching, pull requests, review, and verification |

---

*Application42 · HomeChef · Technical Specification v0.1.0 · August 3, 2026*
