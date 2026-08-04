# HomeChef — Executive Summary

**Application42 · Technical Blueprint for Launch**

| | |
|---|---|
| **Prepared** | August 3, 2026 |
| **Launch** | August 24, 2026 — 21 days |
| **Go/No-Go** | August 9, 2026 — 6 days |
| **Team** | RJ DeLancey (CEO) · Harshal Meka (CTO) · third seat unassigned |
| **Status** | Specifications complete · backlog live in Notion · build not started |

---

## 1. Purpose

This document summarizes a five-part technical blueprint produced from the HomeChef product vision and the commissioned technology research. It records the decisions that are now closed, the risks that remain open, and the dates that cannot move.

The full documents are:

| # | Document | Purpose |
|---|---|---|
| 01 | Technical Specification | Architecture, stack justification, data model, decision engine |
| 02 | Shared Style Guide | TypeScript and PEP 8 standards, commit conventions |
| 03 | Collaboration Blueprint | GitHub Flow, Notion board, Definition of Done |
| 04 | UI/UX Specification | Screens, design tokens, interaction rules |
| 05 | AI Tooling Playbook | Using AI tools without generating unreviewable code |

A sixth file, `CLAUDE.md`, sits at the repository root and supplies this context automatically to coding agents.

---

## 2. What We Are Building

HomeChef is a **decision engine, not a recipe search engine.**

The distinction is the entire strategy. Competitors compete on comprehensiveness — SuperCook indexes eleven million recipes and returns hundreds of results, which converts one form of decision paralysis into another. HomeChef consumes constraints (time, equipment, pantry contents, allergens) and returns three to four answers.

This has a direct engineering consequence that governs the whole build: **showing more options is a regression, not a feature.** Truncation is a product decision defended in code review.

Four differentiators follow, each a deliberate constraint rather than a bolted-on feature:

1. **A decision engine, not a search engine** — a small number of strong options
2. **Time-first, not ingredient-first** — "I have twenty minutes" is the real 6pm constraint
3. **Equipment-aware filtering** — no competitor does this, and it is the dorm-room wedge
4. **A persistent pantry, not a session** — the difference between a tool used twice and a product opened nightly

---

## 3. Technology Decisions

Every decision is recorded as what we chose, what we rejected, and why — so that neither founder re-litigates it under deadline pressure.

| Layer | Chosen | Rejected |
|---|---|---|
| Client | Expo 57 · React Native 0.86 · TypeScript 6.0 | Flutter (no team Dart fluency); three native codebases (team size) |
| Backend | Supabase — PostgreSQL, Auth, RLS, Edge Functions | MongoDB, Firebase (roommate privacy is a relational constraint) |
| Recipe catalog | **Two tiers:** TheMealDB bundled + Spoonacular live | Edamam (no instructions below $399/mo); Calorie API (not a recipe engine) |
| Vision | Gemini 3.6 Flash with structured JSON outputs | HOG+SVM; supervised CNN — reasoning in §4.2 |
| Decision engine | Pure function — same code ranks both catalog tiers | pgvector + Reciprocal Rank Fusion (over-engineered at this scale) |
| Voice | Native OS speech, tap-to-listen | Cloud speech-to-text (cost, latency); wake-word (battery — Phase 2) |
| Python | Build-time catalog pipeline and equipment enrichment | A FastAPI service layer (second deploy target, no product benefit) |

---

## 4. Three Decisions Worth Explaining

### 4.1 Python is the tooling language, TypeScript is the product language

The brief specified Python as the primary language. The research and the team's own Notion pages both specify React Native and TypeScript. That conflict is resolved rather than split.

**TypeScript owns the product** — app, decision engine, Edge Functions. **Python owns the catalog pipeline**, which ingests TheMealDB, normalizes ingredients, and synthesizes the equipment metadata our third differentiator depends on. That is genuinely load-bearing work, it plays to existing team fluency, and it runs at build time rather than in the request path.

Adding a Python service layer between the app and Supabase would have introduced a second deployment target, a second failure mode, and roughly three to five unbudgeted days — for no product benefit. Both language standards are fully specified in the Style Guide.

### 4.2 The image classifier: neither classical CV nor a trained CNN

The brief framed this as HOG+SVM versus CNN. Both are rejected, and the reasoning generalizes.

**HOG + SVM** fails on four independent grounds. It encodes shape, and food is not shape-discriminative — a bell pepper and a tomato produce near-identical gradient histograms while color, the strongest available signal, is discarded. It is a closed vocabulary requiring one classifier per ingredient. It assumes a canonical viewing angle. And it collapses under the occlusion that defines a packed refrigerator.

**A supervised CNN** solves the shape and pose problems but remains a closed vocabulary — every unusual ingredient returns nothing, silently, which is worse than an error. Decisively, the economics do not fit: useful coverage requires tens of thousands of annotated images and a multi-month training pipeline. We have 21 days and three people.

**Gemini 3.6 Flash** (`gemini-3.6-flash`, latest stable) is chosen because open-vocabulary zero-shot recognition is the actual requirement. It identifies gochujang or tahini with no training data from us, accepts multiple images per prompt, and has zero fixed cost.

*Note: an earlier draft specified Gemini 2.0 Flash, which Google has since shut down. Any material still citing it is out of date.*

Output variability is eliminated by **structured outputs** — a JSON schema supplied in the request payload guarantees conforming keys and types, so the response maps directly to database mutations with no parsing layer. Detections below 0.7 confidence go to a user confirmation sheet rather than silently into the pantry.

*A distilled on-device model covering the most common ingredients is a sound Phase 3 cost optimization. It is not a launch strategy.*

### 4.3 The catalog is two tiers, and both are free

TheMealDB ships bundled inside the app — roughly 300 recipes, offline, instant, and ours to keep. Spoonacular is queried live on top of it, adding 380,000 recipes with native equipment filtering whenever the bundled results are thin and quota permits.

The constraint that shapes this is legal. Spoonacular's terms permit storing exactly three fields — recipe ID, title, and image URL. Not ingredients, not instructions, and no derived data, which also rules out running our equipment-enrichment pipeline over their recipes. Their data is borrowed, used in the moment, and discarded.

What makes the hybrid work without compromise is that `decide()` is a pure function over a list of recipes. It has no idea which tier supplied them. Merging is a concatenate-and-deduplicate, and the core product logic stays testable in milliseconds with no network and no API quota.

The free tier allows roughly 15 searches per day across all users — a demo budget, not a production one. That is precisely why the bundled tier exists: when quota runs out or the network drops, the app quietly falls back and the user never sees a failure.

**Total recurring infrastructure cost at launch: $0.**

### 4.4 Hybrid search is correct — and wrong for launch

The research recommends pgvector semantic search fused with keyword filtering via Reciprocal Rank Fusion. At scale this is right, and the Phase 2 design is written up in full so nobody redesigns it under pressure.

At 300 recipes it is over-engineering. The arithmetic: 300 recipes at roughly 10 ingredients each is about 3,000 comparisons — **under 10 milliseconds on a phone.** A network round trip to Supabase costs 50 to 200 milliseconds. Running the decision engine on the server would make it five to twenty times slower.

The engine therefore runs entirely on-device as a pure function. **Trigger for revisiting: catalog above roughly 5,000 recipes.**

---

## 5. Architecture Constraints

Four rules govern the codebase and are enforced in review:

**The engine is pure.** `src/engine/` contains no React, no I/O, and no imports from the data layer. It is the product logic and must be testable in milliseconds without a device, a network, or a database.

**Hard constraints are never relaxed.** Equipment, allergens, and dietary restrictions eliminate candidates absolutely. Soft constraints — time and cuisine — may be relaxed, and every relaxation is stated in the interface with an undo. Silent filter changes teach users not to trust the app.

**The app never shows an empty results screen.** Relaxation is a code path with its own test suite, not an error state. If the design ever calls for an empty state here, the engine has a bug.

**Authorization lives in the database.** Row Level Security means a client-side mistake cannot leak a roommate's allergen list — the database refuses to return the rows. Inventory joins to a household; preferences and allergens join to a user. This single requirement is what eliminated document databases from consideration.

---

## 6. Risk Register — Top Five

| # | Risk | Severity | Mitigation | Owner |
|---|---|---|---|---|
| R11 | **Spoonacular terms violation.** Storing their ingredients or instructions breaches terms; access is revocable without notice. | High | Field whitelist (`id`, `title`, `imageUrl`) enforced in code, not convention. Checked in every review. Attribution shipped before launch. | Harshal |
| R10 | **Spoonacular quota exhaustion.** 50 points/day ≈ 15 searches, across all users. | High | Reserve rule, session caching, single-call fetch. The bundled tier makes exhaustion invisible to users. Demos after 5 PM Pacific, when quota resets. | Harshal |
| R6 | **App Store review latency** may exceed remaining runway. | High | Submit by **Aug 17**. Ship web first — no review gate — and treat iOS as a follow-on. | RJ |
| R4 | **TheMealDB licensing.** Supporter payment required before public release. | High | Pay by **Aug 17**. Hard blocker with a dollar amount. | RJ |
| R3 | **Inventory drift.** The pantry desynchronizes; recommendations rot; users disengage. | High | One-tap "I don't have this" on every ingredient, app-wide, via one shared component. | Harshal |

Catalog thinness and the equipment metadata gap both fell from High to Medium when the second tier landed. Twelve risks are tracked in full in the Technical Specification.

---

## 7. Critical Path

| Date | Milestone | Owner |
|---|---|---|
| **Aug 4–8** | Catalog pipeline and equipment enrichment · Supabase schema and RLS · onboarding flow | Both |
| **Aug 9** | **Go / No-Go.** Does a real dorm pantry return correctly bucketed, equipment-appropriate recipes? GO → build cook mode with voice. NO-GO → plain recipe page, protect the date. *Pre-committed — not re-argued on the day.* | RJ |
| **Aug 10–16** | Photo-to-pantry pipeline · decision engine · results screen · recipe page | Both |
| **Aug 17** | TheMealDB supporter payment · App Store submission | RJ |
| **Aug 18–22** | Accessibility audit · real-user testing · bug fixes | Both |
| **Aug 20** | Supabase keep-alive or Pro upgrade — free tier pauses after 7 idle days | RJ |
| **Aug 23** | **Feature freeze. Absolute.** Anything unmerged ships in the first over-the-air update. | Both |
| **Aug 24** | **Launch** | — |

---

## 8. How the Team Works

**Source control — GitHub Flow.** `main` is always deployable; everything else is a short-lived branch behind a pull request. Git Flow's branch hierarchy exists to coordinate scheduled releases across large teams and buys three people nothing.

**Task tracking — Notion.** The existing Project Management board already has the required three-column model. Twenty-three backlog cards are populated with owners, dates, priorities, and per-card Definition of Done. A strict work-in-progress limit of two cards per person converts the board from a wish list into a scheduling tool.

**Definition of Done — binding.** Three items never bend under deadline pressure, because they are the three teams always cut first:

1. **Automated testing** on the decision engine — a bucketing bug is invisible in manual testing but ships wrong answers to every user
2. **Code review passing** — with two engineers, review is the only defense against a bad merge on August 23
3. **Successful deployment** to the preview build — "works locally" has never once been true when it mattered

**Cadence.** No standing meetings. A written daily check-in in the existing Notion status table, immediate blocker escalation, and one required synchronous meeting: the August 9 go/no-go.

---

## 9. Accessibility

ADA compliance is a Definition-of-Done gate, not post-launch cleanup — and it earns its place on merit rather than obligation.

The same accessibility APIs that serve screen-reader users solve the **situational disability** at the heart of cook mode: a sighted user with raw chicken on their hands has the same interaction problem as a blind user. Live regions, semantic roles, focus grouping, and oversized touch targets serve both populations with one implementation.

Verified before every release with the Xcode Accessibility Inspector and the Android Accessibility Scanner.

---

## 10. Open Items Requiring a Decision

**Assign the third team seat.** Unassigned in all source documents. A third of the team idle on day one of a 21-day sprint compounds daily. Recommended focus, ranked against the risk register: QA and manual testing — including the 30-recipe equipment spot-check, which needs a second pair of eyes to be honest — then accessibility auditing, then catalog QA.

**Close the database decision in Notion.** The `Technicalities` page still lists "MongoDB or Firebase if needed" alongside Supabase. That option is now closed. Leaving it visible invites a parallel implementation the schedule cannot absorb.

Both are cards on the board.

---

## 11. Assessment

The plan is achievable in 21 days, and the reason is that scope was cut rather than stretched. Three specific choices bought back the time: bundling the catalog instead of integrating a live API, running the decision engine client-side instead of building hybrid search, and using a hosted vision model instead of training a classifier.

The schedule's real exposure is not engineering — it is the two external dependencies on August 17. The TheMealDB supporter payment and App Store review are both outside the team's control and both gate a public launch. Shipping web first is the hedge, and it should be treated as the primary launch surface rather than a consolation.

The August 9 gate is the mechanism that protects the date. It is written down now, with its outcomes pre-committed, precisely so that it is decided on evidence rather than on attachment to work already done.

---

*Application42 · HomeChef · Executive Summary · August 3, 2026*
