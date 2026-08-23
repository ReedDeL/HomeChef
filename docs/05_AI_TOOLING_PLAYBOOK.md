# HomeChef — AI Tooling Playbook

**Company:** Application42 · **Product:** HomeChef
**Version:** 0.1.0 · **Date:** August 3, 2026

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

`AGENTS.md` at the repository root is loaded automatically by coding agents. It is the highest-leverage file in the project — it converts our written standards into an automatic constraint on every generation.

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

## 3. Prompting patterns that work here

- Name the governing constraint and the exact source file.
- Ask for tradeoffs before requesting code.
- Ask what breaks and what the prompt omitted.
- Require tests from the specification, not from the implementation.
- Request a terse second pass that removes commentary and single-use abstractions.

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

## 5. Equipment enrichment

Equipment enrichment applies only to owned bundled recipes. Spoonacular data is
borrowed and must never enter the enrichment pipeline. The prompt and validation
belong with the catalog tooling when implemented; until then this playbook does
not carry a copy that can drift from source. Unknown results remain
`unclassified`, and a 30-recipe human spot-check is required before shipping
generated tags.

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

## 9. Repository context file

[`AGENTS.md`](../AGENTS.md) is the single source of truth for coding-agent
context. Keep it concise and update it directly; never maintain a second copy in
this playbook.

---

## 10. The Slop Test

Before merging anything AI-assisted, three questions:

1. **Can I explain every line?** If not, read it again or rewrite it.
2. **Would I have written it this way?** If not, why is this better?
3. **Is it as short as it should be?** Slop is almost always long.

Three questions, thirty seconds. They are the difference between AI making this team faster and AI making this codebase someone else's problem in September.

---

*Application42 · HomeChef · AI Tooling Playbook v0.1.0 · August 3, 2026*
