# HomeChef — AI Tooling Playbook

**Company:** Application42 · **Product:** HomeChef
**Version:** 1.0 · **Date:** August 3, 2026

---

## 0. The honest framing

A three-person team cannot ship this product in 21 days without AI assistance. It also cannot ship it *with* AI assistance if the assistance produces code nobody understands.

**The failure mode has a name: AI slop.** Code that compiles, looks plausible, passes a skim, and is wrong — or right but bloated, over-abstracted, and inconsistent with everything around it. Slop is expensive precisely because it *looks* finished. It converts engineering time into archaeology time.

**Governing rule, and the only one that really matters:**

> **You own every line you merge. If you cannot explain it in review, it does not merge.**

This is not a hedge. It is the mechanism that makes aggressive AI use safe. Once you accept that you will personally defend every line, you naturally stop accepting output you have not read.

---

## 1. Two Lanes

The founders use AI differently because they do different work. Both lanes are legitimate engineering.

| | **RJ — Agentic engineering** | **Harshal — Prompt engineering** |
|---|---|---|
| **Mode** | Delegate whole tasks to an agent with tools; supervise the loop | Tight, iterative pairing on specific code |
| **Good for** | Scaffolding, research synthesis, repetitive edits across files, data wrangling, docs, marketing assets | Algorithms, architecture, debugging, the VLM prompt, code review |
| **Unit of work** | A task | A function |
| **Risk** | Agent goes wide and generates volume nobody reads | Over-reliance on autocomplete; accepting suggestions without reading |
| **Guard** | Small scoped tasks, review the diff before merging | Read every suggestion; reject anything you would not have written |

Neither lane changes the Definition of Done. AI-authored code goes through the same PR, the same review, and the same tests as anything else.

---

## 2. Context Is the Whole Game

The single largest quality difference between useful AI output and slop is **how much correct context the model has.** A model that has not read the Style Guide will produce code that violates it, and you will spend more time correcting it than you saved.

### 2.1 The repo context file

`CLAUDE.md` at the repository root is loaded automatically by coding agents. It is the highest-leverage file in the project — it converts our written standards into an automatic constraint on every generation.

**Keep it under 200 lines.** A context file that grows unbounded dilutes itself; the important rules get lost among the trivia. When it grows, cut rather than append.

### 2.2 Point at the docs

Before any substantial generation, name the relevant document:

```
Read docs/01_TECHNICAL_SPEC.md §4 and docs/02_STYLE_GUIDE.md §2,
then implement the constraint-relaxation path in src/engine/relax.ts.
```

This costs eight seconds and eliminates most of a review cycle.

### 2.3 Point at real code

Better than any description of our style is our style:

```
Follow the structure and density of src/engine/score-recipe.ts.
```

Models match surrounding idiom well when shown it, and badly when asked to infer it.

---

## 3. Prompting Patterns That Work Here

### 3.1 Specify the constraint, not just the goal

```
❌ "Write a function to filter recipes"

✅ "Write `filterByEquipment(recipes, userEquipment)` in src/engine/.
   Pure — no imports from lib/ or React. Recipe.equipmentRequired is a
   closed enum: microwave | stove | oven | air_fryer | kettle | blender |
   rice_cooker | toaster_oven | none. A recipe survives only if every
   required item is in userEquipment; 'none' always survives.
   Return a new array. Include Vitest cases for the empty-equipment
   and all-equipment boundaries."
```

The second prompt takes forty seconds to write and produces mergeable code. The first produces something you will rewrite.

### 3.2 Ask for the tradeoff before the code

For any non-trivial decision:

```
"Three options for handling pantry sync conflicts between roommates.
For each: the failure mode, and the cost at our scale (3-person
households, ~30 items). Recommend one. Don't write code yet."
```

This is where AI is genuinely strongest — surfacing the option you had not considered. Taking the code first skips the thinking.

### 3.3 Make it argue against itself

```
"What's wrong with this approach? What breaks at 10x the pantry size?
What did I not ask about?"
```

Models are agreeable by default. You have to explicitly ask for the objection. The third question — *what did I not ask about* — has the highest yield.

### 3.4 Demand the terse version

Models default to verbose: defensive try/catch around everything, comments on obvious lines, extracted helpers used once, three layers of abstraction where one would do.

```
"Rewrite this at half the length. Remove comments that restate the code.
Inline any helper used exactly once."
```

Run this on anything generated that feels long. It usually is.

### 3.5 Generate the test first

```
"Write Vitest cases for bucketRecipes() covering: zero missing,
the 2/3 boundary, the 4/5 boundary, an empty catalog, and a recipe
with no ingredients. Just the tests."
```

Then implement against them. This inverts the usual failure — tests generated *after* code tend to assert whatever the code already does, including its bugs.

---

## 4. Where AI Helps Most on This Project

Ranked by leverage against our actual 21-day critical path:

| Task | Lane | Why it fits |
|---|---|---|
| **Equipment enrichment pipeline** (R2) | Both | The single highest-value AI use in the build. Extracting structured equipment from free-text instructions is exactly a language task, and it closes our largest data gap. See §5. |
| **Ingredient normalization** | RJ | Mapping messy TheMealDB strings to canonical IDs — high-volume, pattern-heavy, tedious. |
| Boilerplate scaffolding | RJ | Screens, Zod schemas, migrations, RLS policies. Structure is predictable; review is fast. |
| Test generation | Harshal | Boundary cases in `src/engine/` — models are good at enumerating edges humans skip. |
| Debugging | Harshal | Paste the error, the code, and what you expected. Strong at narrowing. |
| Accessibility audit | Harshal | "Which elements here are missing accessibility props?" — mechanical, and easy to miss by hand. |
| Marketing copy, App Store listing | RJ | Fast drafts; RJ owns the voice. |
| Documentation | Both | Keeping `docs/` synchronized with code changes. |

### Where AI helps least — and where to be suspicious

- **The four-bucket ranking function.** This is the product. A plausible-looking scoring heuristic that is subtly wrong ships bad recommendations to every user, and manual testing will not catch it. Write it by hand; use AI for the tests.
- **Allergen filtering.** A safety path. Both founders review regardless of authorship.
- **Anything touching RLS policies.** A wrong policy leaks a roommate's medical information. Generate if you like, but verify manually with a second test account — every time.
- **Anything writing Spoonacular data to the database.** A model asked to "save the recipe" will helpfully persist ingredients and instructions, because that is what every tutorial in its training data does. That is a Terms of Use violation that can get our access revoked. **Only `id`, `title`, `imageUrl`.** Review every Spoonacular write path by hand.
- **Novel architecture decisions.** Models regress to the most common pattern in their training data, which is frequently over-engineered for a three-person team. This is precisely how we would have ended up with pgvector and Reciprocal Rank Fusion over 300 recipes.

---

## 5. The Equipment Enrichment Prompt

This is a production component, not a convenience — it generates the metadata our third product wedge depends on. Treat it as code: version it, test it, review changes to it.

> ⚠️ **Runs on TheMealDB (Tier 1) recipes only.** Spoonacular supplies equipment natively, and running this pipeline over their data would produce "derived data," which their Terms of Use prohibit. If you find yourself pointing this script at a Spoonacular response, stop.

**Location:** `tools/catalog/src/catalog/prompts/equipment.py`

```python
EQUIPMENT_PROMPT = """\
You are extracting required cooking equipment from a recipe's instructions.

Return ONLY equipment that is REQUIRED to complete the recipe.
Do not include optional conveniences, serving dishes, or utensils
(bowls, spoons, knives, plates).

Allowed values — use no others:
microwave, stove, oven, air_fryer, kettle, blender, rice_cooker,
toaster_oven, none

Rules:
- "none" means no heat source or powered appliance is required
  (for example, a salad or a sandwich).
- If instructions say "bake", the oven is required.
- If instructions say "fry", "sauté", "simmer", or "boil" in a pan
  or pot, the stove is required.
- A recipe may require multiple items. List every one.
- When genuinely ambiguous, choose the MORE demanding equipment.
  A false "microwave-only" tag is far worse than a false "stove" tag:
  it surfaces an impossible recipe to a dorm user and destroys trust
  on first use.

Instructions:
{instructions}
"""
```

**Why the last rule matters, and why it is written down:** the asymmetry of the error is the whole design. Over-tagging costs a user one missed suggestion. Under-tagging shows a microwave-only student a recipe they cannot cook — which is the exact failure the equipment wedge exists to prevent.

**Validation is mandatory:**

1. Structured output with a closed enum — the model cannot invent `"instant_pot"`.
2. Pydantic validation on every response.
3. **Human spot-check of 30 recipes before the catalog is committed.** Non-negotiable, and the accuracy rate gets logged in the Notion status report so we know what we shipped.

---

## 6. Review Standards for AI-Generated Code

Every PR gets the same review. But these specific slop patterns show up often enough to be worth naming, so a reviewer can spot them fast:

| Pattern | What it looks like | Action |
|---|---|---|
| **Comment noise** | `// Increment the counter` | Delete. Style Guide §1.2. |
| **Defensive bloat** | try/catch around code that cannot throw | Remove. |
| **Premature abstraction** | A factory, a strategy interface, and a registry for two cases | Inline it. |
| **Single-use helpers** | Three one-line functions called once each | Inline them. |
| **Invented APIs** | Calls to methods that do not exist on our types | Verify against real signatures. Models hallucinate confidently. |
| **Ignored conventions** | `IRecipe`, default exports, hardcoded `#D94F14` | Fix to match the guide. |
| **Wrong density** | 60 lines where the surrounding file does it in 15 | Rewrite terse. |
| **Fabricated tests** | Tests asserting whatever the code happens to do | Rewrite from the spec, not from the implementation. |

**Reviewer's question, asked out loud:** *"Would I have written this?"* If the answer is no and you cannot articulate why the AI's version is better, it does not merge.

---

## 7. What Never Goes Into a Prompt

- API keys, service-role tokens, `.env` contents
- Supabase connection strings
- Real user data — photos, emails, pantries
- Anything under NDA

For debugging with real data shapes, use synthetic examples that match the structure.

---

## 8. Attribution

We do **not** mark AI-generated code in comments or commits. Reasons: it dates instantly, it clutters the diff, and — more importantly — it implies a different quality standard applies. It does not. Whoever merges it, wrote it.

---

## 9. Repository Context File

**`CLAUDE.md` exists at the repo root — [read it there](../CLAUDE.md).** It is the single source of truth for agent context; the outline below is illustrative only, and if the two ever disagree, `CLAUDE.md` wins. Do not maintain a second copy.

Keep it under 200 lines. When it grows, cut rather than append — a context file that grows unbounded dilutes itself, and the important rules get lost among the trivia.

<details>
<summary>Shape of the file (illustrative)</summary>

```markdown
# HomeChef

Photo-based meal decision engine. Application42.
Launch: Aug 24, 2026. Full specs in `docs/`.

## What this is
Not a recipe search engine — a decision engine. It consumes constraints
(time, equipment, pantry, allergens) and emits 3-4 answers. Showing more
options is a regression, not a feature.

## Stack
Expo 57 · React Native 0.86 · React 19.2 · TypeScript 6.0 (strict)
expo-router · TanStack Query (server state) · Zustand (client state)
Supabase — Postgres, Auth, RLS, Edge Functions
Recipes: Tier 1 = TheMealDB bundled in `src/data/` (offline, owned)
         Tier 2 = Spoonacular live (borrowed — only id/title/imageUrl stored)
Vision: `gemini-3.6-flash` via Edge Function, structured outputs

## Architecture rules
- `src/engine/` is PURE. No React, no imports from `src/lib/`, no I/O.
  It is the product logic and must be testable without a device.
- Third-party API keys live only in Edge Functions. Never in the client.
- Every table has RLS. Inventory joins to household; preferences join to user.
- Hard constraints (equipment, allergens, dietary) are NEVER relaxed.
  Soft constraints (time, cuisine) may be — and relaxation is always
  stated in the UI, never silent.
- No hardcoded colors or spacing. Use `src/theme/tokens.ts`.

## Style — see docs/02_STYLE_GUIDE.md
- No `any`. Use `unknown` and narrow.
- Named exports (except expo-router route files).
- Comments explain WHY. Never comment what the code already says.
- Accessibility props required on every interactive element — CI enforces this.
- Commits: imperative, <50 chars. "Add equipment filter", not "added filter".
- Python (`tools/`): PEP 8 via Ruff, mypy strict, full type hints.

## Vocabulary — use these exact words
pantry · catalog · bucket · equipment tier · household · drift

## Don't
- Don't add pgvector or hybrid search. ~320 recipes ranks client-side in <10ms.
- Don't persist Spoonacular ingredients or instructions. Only id/title/imageUrl.
- Don't add a Python service layer. Python is build-time tooling only.
- Don't suggest MongoDB or Firebase. That decision is closed.
- Don't build: shopping list, barcode scanning, wake-word voice,
  macro tracking. Out of scope for launch.
```

</details>

---

## 10. The Slop Test

Before merging anything AI-assisted, three questions:

1. **Can I explain every line?** If not, read it again or rewrite it.
2. **Would I have written it this way?** If not, why is this better?
3. **Is it as short as it should be?** Slop is almost always long.

Three questions, thirty seconds. They are the difference between AI making this team faster and AI making this codebase someone else's problem in September.

---

*Application42 · HomeChef · AI Tooling Playbook v1.0 · August 3, 2026*
