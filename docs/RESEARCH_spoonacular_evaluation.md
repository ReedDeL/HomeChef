# Research: Spoonacular as the Recipe Database

**Status:** ✅ **DECIDED — Option C (hybrid). RJ, August 3, 2026.**
**Outcome:** TheMealDB bundled as Tier 1, Spoonacular free tier live as Tier 2. Both free. Gemini Flash free tier for vision.
**All specifications have been updated.** This document is retained as the decision record — the reasoning below is why, not what.

> **What shipped:** Option C, as recommended in §7. The bundled tier preserves offline cook mode, engine purity, and a guaranteed floor under every query; Spoonacular adds breadth and native equipment filtering when quota and connectivity allow. Total recurring cost: $0.
>
> **Implementation:** Technical Spec §2.3 (catalog), §4.1–4.3 (engine and escalation), §5.3 (Edge Function), §8 (risks R10–R12).

---

## 0. The question

Can Spoonacular's free tier replace TheMealDB as HomeChef's actual recipe database — solving catalog thinness (R1) and the equipment metadata gap (R2) in one move?

**Short answer: the free tier cannot, and the reason is legal rather than technical.** There is a $10/month academic plan that changes the picture substantially, but it forces an architecture we have not planned for.

---

## 1. What Spoonacular would solve

Genuinely attractive, and worth being honest about:

| Our problem | What Spoonacular offers |
|---|---|
| **R1 — catalog thinness (~300 recipes)** | 380,000+ recipes. Risk R1 disappears entirely. |
| **R2 — no equipment metadata** | `complexSearch` has a native `equipment` parameter. Our whole Python enrichment pipeline — and its 30-recipe spot-check — becomes unnecessary. |
| **Four-bucket logic** | `findByIngredients` returns `usedIngredients` and `missedIngredients` natively. Our bucketing comes almost free. |
| **Ingredient normalization** | A published list of the 1,000 most common ingredients with stable IDs. Removes our messiest ETL step. |
| **Dietary + allergen filtering** | A real food ontology — it knows "nut free" excludes pecans, and that Worcestershire sauce isn't vegetarian. Meaningfully better than anything we'd build in three weeks. |

If this were only an engineering question, Spoonacular would win on the merits.

---

## 2. The blocker: you cannot store the data

From Spoonacular's [Terms of Use](https://spoonacular.com/food-api/terms) (last updated April 16, 2026):

> "You may not scrape the spoonacular API or in any way attempt to copy or store the information it provides, **including any derived, hashed, or transformed data.** With prior written permission from spoonacular, you may cache user-requested data to improve performance (**for a maximum of 1 hour**). After 1 hour, you must delete your cache... If you stop using the spoonacular API or if your access is suspended for any reason, then you must **delete all data you ever obtained**."

> "**Exempt from caching restrictions:** You can indefinitely store the recipe id, the recipe title, and the recipe image url... However, **you may not store any other data**, including but not limited to ingredients, instructions, nutritional information."

### What this breaks

You may permanently store exactly three fields: **recipe ID, title, image URL.** Not ingredients. Not instructions.

| Our architecture | Status under these terms |
|---|---|
| **Bundled JSON catalog** in `src/data/` | ❌ Prohibited outright |
| **Client-side decision engine** | ❌ Dead. Set-difference of pantry against every recipe requires local ingredient lists. We can't store ingredients, so every query must hit their API. |
| **Offline cook mode** | ❌ Dead. Instructions can't be stored, so no signal means no recipe. |
| **Python equipment enrichment** | ❌ Prohibited. Output is explicitly "derived data." |
| **Phase 2 "cache into Postgres, build a proprietary index"** | ❌ Prohibited. *This was in our spec and was wrong — the original research doc's suggestion to check ToS was correct, and the ToS says no.* |
| **Recipe ID + title + image** | ✅ Allowed — enough for saved meals and history |

There is also a competition clause worth reading before committing: you may not build "a site or application meant to provide the same experience as spoonacular." Spoonacular publishes a "what's in my fridge" feature. I don't think we're squarely in violation — our product is a narrowing decision engine, theirs is a search API — but it is a real dependency risk with a company that can revoke access without notice.

---

## 3. The free tier is unusable regardless

Confirmed from [Spoonacular's pricing page](https://spoonacular.com/food-api/pricing) — note that the number in our original research doc (150/day) was wrong:

| Plan | Cost | Quota | Notes |
|---|---|---|---|
| **Free** | $0 | **50 points/day** | Backlink required · 1 req/s · no SLA |
| **Academic / Hackathon** | **$10/mo** | **~5,000 requests/day** | Via RapidAPI · university email · manual approval, up to 72h |
| Cook | $29/mo | 1,500 points/day | then $0.005/point |
| Culinarian | $79/mo | 4,500 points/day | then $0.004/point |

**Point cost per search:** `Search Recipes` = **3 requests + 1 result-point per recipe returned.**

So on the free tier: 50 points ÷ ~4 points per search ≈ **12 searches per day, across all users, total.** Two people testing exhaust it before lunch. The free tier is a development sandbox, not a production backend.

---

## 4. The realistic option: the $10 academic plan

This is the finding that actually matters, and it wasn't in the original research doc.

**Both founders are UCSC students.** Spoonacular offers **5,000 requests/day for $10/month** on an academic plan, requested with a university email through RapidAPI.

That's roughly 1,200 searches/day — enough for a student launch. But three caveats:

1. **Manual approval, up to 72 hours.** Apply *immediately* if this is under real consideration. Applying on Aug 20 is applying too late.
2. **Backlink required.** Academic and free plans must link to Spoonacular's food API page from the app. A visible dependency on a competitor's brand inside a product positioned against recipe search.
3. **The storage restriction still applies.** $10/month buys quota, not the right to keep the data.

---

## 5. What the architecture would become

If we adopt Spoonacular, this is not a swap — it is a different product architecture:

| | **TheMealDB (current plan)** | **Spoonacular** |
|---|---|---|
| Catalog | ~300 recipes | 380,000+ |
| Equipment data | We synthesize it (R2) | Native parameter |
| Decision engine | Client-side, pure function, <10ms | **Server-side, live API call every query** |
| Offline | Full — cook mode works with no signal | **None** |
| Latency to results | ~10ms | ~300–800ms + their rate limit |
| Cost at launch | $0 (+ one-time supporter fee) | $10/mo, quota-capped |
| Data ownership | We own the bundle | **We own three fields** |
| Failure mode | None — it's in the app | Their outage = our outage |
| Vendor risk | None post-download | Access revocable without notice |
| `src/engine/` purity | Preserved | **Broken** — the engine now needs I/O |

The last row is the one I'd weigh most heavily. Our entire testing strategy rests on `src/engine/` being a pure function testable without a network. Spoonacular makes the decision engine a network-bound service, which means the core product logic can only be tested against a live third-party API with a daily quota.

---

## 6. Options

### Option A — Stay with TheMealDB *(no change)*

Keep everything as specified. Accept ~300 recipes; the Aug 9 gate tests whether that's enough.

**For:** offline, instant, free, we own the data, `src/engine/` stays pure, zero vendor risk, no schedule change.
**Against:** R1 stays open; thin results for microwave-only pantries — exactly our wedge.

### Option B — Spoonacular as the live backend

Replace the bundled catalog. Every results query hits their API.

**For:** R1 and R2 both vanish. Native bucketing and equipment filtering. Better allergen ontology than we'd build.
**Against:** no offline mode, no cook mode without signal, decision engine becomes network-bound, backlink to a competitor, access revocable, quota-capped, **and a significant mid-sprint rewrite 21 days from launch.**

### Option C — Hybrid *(worth considering)*

Ship TheMealDB bundled as the guaranteed floor. Add Spoonacular as a live "more ideas" section that appears only when the local buckets are thin — displayed but never stored, which is ToS-compliant.

**For:** offline core preserved, `src/engine/` stays pure, R1 mitigated without betting the launch on a third party, degrades gracefully when quota runs out or the network drops.
**Against:** two data paths to build and test; the $10 plan and its 72-hour approval still apply.

### Option D — Enrich TheMealDB instead

Leave the catalog at ~300 but let users add their own recipes, and hand-write 20–30 microwave-only recipes targeted at the dorm wedge.

**For:** cheapest, no vendor, directly attacks the *specific* thin spot rather than catalog size generally.
**Against:** manual content work; doesn't scale past the student wedge.

---

## 7. My read

**I'd lean Option A or C, not B.**

The case against B is not that Spoonacular is a bad API — it's very good. It's that adopting it 21 days out converts three of our stated architectural guarantees into their opposites: offline becomes online-only, pure becomes network-bound, owned becomes borrowed. Any one of those is survivable. All three at once, mid-sprint, with a hard external launch date, is the kind of change that eats a schedule.

There's also a product argument worth stating. 380,000 recipes is a *search engine's* asset. We are explicitly not a search engine — our thesis is that showing more options is a regression. Catalog thinness hurts us in one specific place: the microwave-only dorm pantry. That is a narrow, targetable gap, and Option D attacks it directly for roughly zero dollars.

**If you want the catalog breadth, Option C gets most of it without surrendering the architecture.**

**Regardless of which way you go: if Spoonacular is even under consideration, apply for the academic plan today.** Approval takes up to 72 hours and costs $10. Having the key and not using it costs nothing; needing it on Aug 18 and not having it costs the option entirely.

---

## 8. If you choose B or C, what changes

So the cost is visible before you decide:

- Technical Spec §2.3 (catalog), §4.1 (engine), §5.2 (Python pipeline — largely deleted), §9 (repo layout)
- Risk register: R1 and R2 close; new risks open for vendor dependency, quota exhaustion, and offline loss
- Notion backlog: "Build TheMealDB catalog ingest" and "Enrich catalog with equipment metadata" are cut or rewritten — that's Harshal's entire Aug 4–9 block
- Aug 9 go/no-go criteria need rewriting
- Attribution and backlink requirements enter the UI spec
- **Harshal's next five days change completely** — decide before Aug 4 if the answer is B

---

## Sources

- [Spoonacular Terms of Use](https://spoonacular.com/food-api/terms) — storage and caching restrictions, competition clause
- [Spoonacular API Pricing](https://spoonacular.com/food-api/pricing) — free tier 50 points/day; $10 academic plan
- [Spoonacular Quotas](https://spoonacular.com/food-api/docs/quotas) — per-endpoint point costs
- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models) — model availability and deprecations
