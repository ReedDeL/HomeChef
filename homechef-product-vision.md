# HomeChef — Product Vision & Feature Reference

> ***"Making Chefs Go Extinct!"***

---

## Problem Statement

The user needs to come up with a meal idea fast. This app prompts the user into quickly making a decision on what to cook.

The user does not need a list of possibilities — they need to **stop deciding**.

**Platform:** iOS, Android, and Web App

---

## Target User

| Phase | User | Why this order |
|---|---|---|
| **Now** | College students | Worst served by existing apps, hardest constraints (no equipment, low budget, small pantry), and the group we can physically reach for testing. Constraints are a feature — they make the product sharper. |
| **Next** | Young adults short on meal ideas | Same decision problem, fewer constraints. Largely the same product with the equipment filter relaxed. |
| **Later** | Time-poor working adults | Needs servings scaling, family preferences, and planning ahead — a materially different product. |

**Marketing focus:** college students primarily, young adults secondarily.

---

## Core Product Concept

An **inventory-driven meal decision engine**. The user builds a persistent ingredient inventory via photo recognition, barcode scan, or manual entry. The app instantly returns a small number of strong meal recommendations they can make *right now*, filtered by what they own, what they can cook with, and how much time they have.

The persistent pantry is the moat. Session-based competitors hand back a list; we hand back a decision.

---

## 4. Feature Set

### Inventory

- **Entry methods:** photo recognition, barcode scan, manual entry from a browsable list.
- **Custom items:** user can add their own ingredients and recipes when the free recipe/product databases lack them (relevant given a ~300-recipe base catalog).
- **Aggregation by ingredient TYPE, not brand.** "Chicken breast," not "Tyson Chicken Breast 3lb." Brand-level granularity adds friction without improving matching.
- **Quantity counts** tracked per ingredient.
- **Auto-assumed pantry staples** (salt, pepper, oil, common spices) pre-populated on first run; the user can remove any of them.
- **Purchase-date tracking** with estimated expiration dates, warnings before an item expires, and auto-removal after expiry.
- **Inventory drift handling:** at meal-selection time the user can mark any ingredient as not-actually-available; it is removed from inventory immediately. This is how we survive the user cooking off-app.
- **Constant sync across devices.**

### Recommendation Engine

Filters applied:

- Available ingredients (primary)
- Allergies — **entered once during onboarding, saved, never re-asked**
- Dietary restrictions and preferences
- Weight gain/loss goals
- Cooking equipment owned
- Time available
- Food genre / cuisine

Output behavior:

- Results sorted into **four buckets**: *All ingredients*, *Most*, *Some*, *Requires a grocery list*.
- Within each bucket, results are **capped and ranked by highest ingredient match first**.
- Every recommendation must use at least some ingredients already in inventory.
- We show a **small number of strong options, not everything that matches.** Three good answers beat four hundred.
- Each result displays **cook time** up front.
- A first-class **"I don't have enough time"** button re-ranks toward the fastest viable options.

### Preference Learning

- Saved meals (likes) and remembered dislikes.
- Disliked meals are suppressed from future recommendations.
- The saved-meal page shows **still-missing ingredients** and the **date the meal was originally made**.

### Shopping List 

- Missing ingredients from any recipe can be pushed to an in-app shopping list with one tap.
- List is grouped by recipe and de-duplicated across recipes.

### Cook Mode

- Full recipe page with ingredient quantities and step-by-step instructions.
- **Hands-free voice navigation** to advance to the next step while cooking.
- Works offline (recipe catalog is bundled in the app).

### Shared / Roommate Pantry

- Roommates can share a single ingredient inventory with **constant sync**.
- **Meal preferences do NOT sync** — likes, dislikes, allergies, and goals stay personal.

### Non-Functional Requirements for web page and legal coverage

- ADA compliant.
- Privacy, safety, and security hardened.
- Cross-device data access.

---

## Core Values that make us different from other companies 

> We tell you what to make.**

### A decision engine, not a search engine

We show a small number of strong options, not everything that matches. This is a product decision competitors structurally cannot copy — their entire value proposition is comprehensiveness.


### Equipment-aware filtering

The student wedge, and the one no competitor addresses. A dorm room is a microwave and maybe a kettle. Recommending a braise to someone without an oven destroys trust on first use.

Users declare their kitchen once during onboarding, and every suggestion respects it:

| Kitchen tier | Reality |
|---|---|
| **Microwave only** | Dorm room. The hardest and most under-served case — and the one that earns the most loyalty if we get it right. |
| **Microwave + kettle / hot plate** | Typical dorm with a little improvisation. |
| **Shared or full kitchen** | Stove and oven available, possibly shared and time-constrained. |
| **Small appliances** | Toggles for air fryer, rice cooker, blender, toaster oven. Air fryer ownership among students is high enough to matter on its own. |

### Pantry Database

Competitors that ask you to re-enter ingredients every time are tools you use twice. A pantry that remembers is a product you open at 6pm every night.

---


## Business Model

- **Completely free at launch.** No paywall, no feature gating, no trial.
- **Periodic tip prompts** — the only monetization until scale.
- **At user-mass threshold:** introduce ads, plus a **one-time payment to remove ads permanently.**
- **No subscription. Ever.** This is a positioning decision, not just a pricing one — every serious competitor in the category is subscription-based, and free-forever is the wedge with a student audience that has no disposable income.

---

## Technical Stack

### Recipe & Product Data

| Source | Cost | Verdict |
|---|---|---|
| **TheMealDB** *(chosen)* | Free | ~300 recipes with **full cooking instructions**, ingredients with measures, and images. Test key covers development and educational use; a supporter payment is needed before public app store release. We pull the catalog **once at build time** and ship it inside the app — no runtime API calls, no key to protect, no quota, and cook mode works offline by default. |
| **Spoonacular** *(optional fallback)* | Free tier | 50 points/day, no credit card. Full instructions, `findByIngredients` bucketing, equipment parameter. Held in reserve for catalog breadth if the Week 2 go/no-go shows ~300 recipes isn't enough. |

### Stack

| Layer | Tool |
|---|---|
| Framework | Expo 57 |
| Routing | expo-router (file-based, typed routes) |
| UI | React Native 0.86 / React 19.2 |
| Language | TypeScript 6.0 |
| Backend logic | Python |
| Recipe data | Bundled JSON in `src/data/` |
| Local storage | `expo-sqlite` + `react-native-mmkv` |
| Accounts | Supabase |
| Database | MongoDB or Firebase if needed |
| Editor | VSCode |
| Version control | GitHub |


---

## Timeline

- **MVP:** manual ingredient selection, image scanning (API-based), meal recommendation.
- **Main page deadline: August 24, 2026.**

## Team

| Role | Person | Skills |
|---|---|---|
| Co-Founder / CEO | RJ DeLancey | Prompt engineering, Python |
| Co-Founder / CTO | Harshal Meka | Python, Assembly, Java |

**Potential recruitment:** Arvind Rai (Python, Bash, AI automation); Ibrahim Shah (business, creativity).


---

## Additional features

1. **Weight gain/loss goal filter 
2. **Allergies — asked once at onboarding, saved, never re-asked.** Confirmed.
3. **Bucketing — four buckets** (All / Most / Some / Requires a grocery list), each capped and ranked by match % within the bucket. Confirmed.
4. **Local storage — `expo-sqlite` + `react-native-mmkv`.** SQLite for relational pantry/recipe queries, MMKV for fast key-value reads (session, prefs, cook-mode resume). Decided.
5. **Equipment tagging of the bundled catalog — owned by Harshal**, as part of the same build-time Python pipeline that ingests and normalizes the catalog.
6. **Barcode scanning — cut entirely.**
7. **No version numbers in these docs.** Week/phase labels describe build order only; RJ and Harshal will name actual versions themselves.
