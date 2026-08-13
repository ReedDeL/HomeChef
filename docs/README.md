# HomeChef — Blueprint for Success

**Company:** Application42 · **Product:** HomeChef
**Date:** August 3, 2026 · **Launch:** August 24, 2026 — **21 days**

---

## Start here

| # | Document | Read if you are... | Length |
|---|---|---|---|
| 01 | [Technical Specification](01_TECHNICAL_SPEC.md) | Making any technical decision | Long — the core document |
| 02 | [Shared Style Guide](02_STYLE_GUIDE.md) | Writing code | Reference |
| 03 | [Collaboration Blueprint](03_COLLABORATION_BLUEPRINT.md) | Working with the team | Medium |
| 04 | [UI/UX Specification](04_UIUX_SPEC.md) | Building a screen | Medium |
| 05 | [AI Tooling Playbook](05_AI_TOOLING_PLAYBOOK.md) | Using AI to build faster | Medium |
| 06 | [API Keys & Environment](06_API_KEYS_AND_ENV.md) | Setting up any third-party service | Short — **read before coding** |
| 07 | [iPhone Web Testing Guide](HOW_TO_TEST_IPHONE_WEB.md) | Testing HomeChef on iOS Safari (Web) | Short — **testing guide** |
| — | [`../AGENTS.md`](../AGENTS.md) | A coding agent (loaded automatically) | Short |

**RJ, read first:** 03 (process, roles, critical path) → 01 §8 (risk register — three of the launch blockers are yours) → 04 (product surface).

**Harshal, read first:** 01 (all of it) → 02 (standards) → 05 §5 (the equipment prompt you own).

---

## The decisions, in one page

| Layer | Choice |
|---|---|
| Client | Expo 57 · React Native 0.86 · TypeScript 6.0 |
| Backend | Supabase Postgres + RLS + Edge Functions |
| Recipes — Tier 1 | **TheMealDB** bundled (~300, offline, owned) |
| Recipes — Tier 2 | **Spoonacular** live query (380k, 50 pts/day, nothing stored) |
| Vision | `gemini-3.6-flash` + structured outputs |
| Decision engine | Pure function — same code ranks both tiers |
| Voice | Native OS speech, tap-to-listen |
| Python's role | Build-time catalog pipeline + equipment enrichment (Tier 1 only) |

**Total recurring cost at launch: $0.** All three services on free tiers.

### The catalog is two tiers

Tier 1 is the floor: ~300 recipes bundled in the app, offline, instant, ours. Tier 2 adds 380,000 recipes live from Spoonacular when the bundled buckets are thin and quota allows.

The reason this works is that `decide()` is a pure function over a `Recipe[]` — it has no idea which tier supplied the recipes. Merging is a concatenate-and-dedupe. **`src/engine/` stays testable in milliseconds with no network and no quota.**

Two constraints that follow, and they are absolute:

- **Spoonacular data is borrowed.** Their terms permit storing exactly three fields — `id`, `title`, `imageUrl`. Not ingredients, not instructions, and no derived data (which rules out running our equipment enrichment over their recipes).
- **50 points/day ≈ 15 searches, across all users.** Tier 2 is best-effort. Tier 1 means the user never sees a failure.

⏰ **Spoonacular quota resets at 5 PM Pacific. Schedule demos after that.**

### Closed decisions — do not reopen

- **Supabase Postgres only.** Not MongoDB, not Firebase. Shared pantry with private allergens is relational, enforced by RLS at the database engine.
- **No pgvector, no hybrid search.** ~320 recipes ranks client-side in under 10ms — faster than a round trip to our own server.
- **TypeScript is the product language.** Python owns the build-time catalog pipeline but never enters the request path.
- **No Flutter, no separate native codebases, no Edamam.**
- **Catalog: two-tier hybrid.** Decided Aug 3. Rationale in `RESEARCH_spoonacular_evaluation.md`.

---

## The dates that matter

| Date | Event | Owner |
|---|---|---|
| **Aug 9** | ★ **Go/No-Go.** Does a real dorm pantry return correctly bucketed, equipment-appropriate recipes? NO-GO → cut cook mode to a plain recipe page and protect Aug 24. **Decision pre-committed — do not re-argue it on the day.** | RJ |
| **Aug 17** | ★ TheMealDB supporter payment — required before public release | RJ |
| **Aug 17** | ★ App Store submission — review latency is the risk, not the build | RJ |
| **Aug 20** | ★ Supabase keep-alive or Pro upgrade — free tier pauses after 7 idle days | RJ |
| **Aug 23** | ★ Feature freeze. Fixes only. Absolute. | Both |
| **Aug 24** | ★ **LAUNCH** | — |

---

## The three biggest risks

1. **Spoonacular ToS violation** — storing their ingredients or instructions breaches their terms and can revoke access without notice. Mitigated by an explicit field whitelist enforced in code, checked in every review. *Owner: Harshal.*
2. **Inventory drift** — the pantry is always somewhat wrong; if correcting it is a chore, recommendations rot and users leave. Mitigated by one-tap "I don't have this" on every ingredient chip, app-wide, via a single shared component. *Owner: Harshal.*
3. **App Store review latency** — outside our control and gating a public launch. Submit by Aug 17; ship web first, it has no review gate. *Owner: RJ.*

Catalog thinness and the equipment metadata gap both dropped from High to Medium once Tier 2 landed. Full register — twelve risks: Technical Spec §8.

---

## Open items

- **Assign the third seat.** Unassigned in the source documents. Recommended: QA, accessibility auditing, and catalog spot-checking. An unassigned third of the team on day one of a 21-day sprint compounds daily. *(Collaboration Blueprint §1.2)*
- **Update Notion `Technicalities`** to remove "MongoDB or Firebase if needed" so nobody starts a parallel implementation.

---

*Application42 · HomeChef · August 3, 2026*
