# HomeChef — Shared Style Guide

**Company:** Application42 · **Product:** HomeChef
**Project development version:** 0.1.0 · **Style policy version:** 1.0 · **Updated:** August 22, 2026
**Applies to:** every line of code, every commit, every pull request.

---

## 0. Why this document exists

Two people writing in two personal styles produces a codebase that reads like an argument. With 21 days and a hard launch date, time spent decoding a teammate's formatting is time not spent shipping.

**The governing principle:** _most style questions should be answered by a tool, not by a person._ Formatters and linters are configured once, run automatically, and are never debated in a pull request. Human review is reserved for things tools cannot check — naming, structure, and whether the code is correct.

**Language split** (resolved in Technical Spec §2, Architecture):

| Language       | Owns                                                                    | Standard |
| -------------- | ----------------------------------------------------------------------- | -------- |
| **TypeScript** | The product — app, engine, Edge Functions                               | §2       |
| **Python**     | Build-time tooling — catalog ingest, equipment enrichment, eval scripts | §3       |
| **SQL**        | Migrations, RLS policies                                                | §4       |

Python is not a second-class citizen here. It owns the catalog pipeline, which produces the entire product catalog and closes our largest data gap. It simply does not run in the request path.

---

## 1. Universal Rules

These hold in every language.

### 1.1 Formatting is automated and never discussed

Formatters run on save and in CI. A pull request is never blocked on whitespace, because whitespace cannot be wrong — the formatter already fixed it.

```jsonc
// .vscode/settings.json — committed to the repo, not personal config
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.codeActionsOnSave": { "source.organizeImports": "explicit" },
  },
}
```

### 1.2 Comment policy — sparse and meaningful

**Comments explain _why_. Code explains _what_. If a comment explains what, delete the comment and fix the name.**

Never write this:

```ts
// Increment the counter
counter += 1;

// Loop through the recipes
for (const recipe of recipes) { ... }
```

These add characters and subtract attention. They are the most common form of AI-generated slop and they will be flagged in review.

Write this instead:

```ts
// An approved archive represents optional ingredient slots as empty strings or
// null rather than omitting them. Filtering here keeps the internal model normal.
const ingredients = raw.filter((i) => i && i.trim().length > 0);
```

```ts
// Confidence floor is 0.7 because below that the VLM starts confusing
// visually similar produce (bell pepper / tomato). Anything under it
// goes to the confirmation sheet rather than silently into the pantry.
const CONFIDENCE_FLOOR = 0.7;
```

Both of these encode knowledge that is genuinely unavailable from reading the code.

**Comment when, and only when:**

- The _why_ is non-obvious — a workaround, a business rule, a deliberate tradeoff.
- A magic number needs justification.
- A third-party API behaves surprisingly.
- The obvious approach was tried and failed. Say so, and say why, or someone will try it again.
- A `TODO` — and it must carry an owner: `// TODO(harshal): ...`

**Do not comment:**

- Self-evident operations.
- Anything the type signature already states.
- Commented-out code. Delete it. Git remembers.
- Section-divider banners (`// ===== HELPERS =====`). If a file needs internal signposting, it needs splitting.

### 1.3 Naming

- Names state intent, not type. `recipes`, not `recipeArray`.
- Booleans read as assertions: `isReady`, `hasAllergen`, `canMakeNow`.
- No abbreviations except universally understood ones (`id`, `url`, `api`, `db`).
- Domain vocabulary is fixed and shared across TypeScript, Python, SQL, and the Notion board:

| Term               | Means                              | Never call it            |
| ------------------ | ---------------------------------- | ------------------------ |
| **pantry**         | The household's current inventory  | fridge, stock, items     |
| **catalog**        | The bundled recipe set             | database, recipes list   |
| **bucket**         | One of the four feasibility groups | category, tier, section  |
| **equipment tier** | Declared kitchen capability        | kitchen type, level      |
| **household**      | The unit sharing a pantry          | group, family, roommates |
| **drift**          | Pantry/reality desynchronization   | staleness, error         |

Using a synonym for any of these in code, a commit, or a ticket is a review comment. Shared vocabulary is how a three-person team stays coherent without meetings.

### 1.4 Line length

100 characters, both languages. Long enough to avoid absurd wrapping, short enough for a side-by-side diff.

---

## 2. TypeScript Standard

### 2.1 Tooling

| Tool       | Role                                    | Config             |
| ---------- | --------------------------------------- | ------------------ |
| Prettier   | Formatting — the only authority         | `.prettierrc`      |
| ESLint     | Correctness, `typescript-eslint` strict | `eslint.config.js` |
| TypeScript | `strict: true`, **non-negotiable**      | `tsconfig.json`    |

```jsonc
// .prettierrc
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
}
```

```jsonc
// tsconfig.json — the parts that matter
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
  },
}
```

`noUncheckedIndexedAccess` is worth the friction it causes. `recipes[0]` types as `Recipe | undefined`, which is the truth, and it catches the empty-catalog bug before it reaches a user.

### 2.2 Naming conventions

| Kind                          | Convention                  | Example                             |
| ----------------------------- | --------------------------- | ----------------------------------- |
| Variables, functions          | `camelCase`                 | `missingIngredients`, `scoreRecipe` |
| Types, interfaces, components | `PascalCase`                | `ScoredRecipe`, `IngredientChip`    |
| Constants (module-level)      | `SCREAMING_SNAKE_CASE`      | `CONFIDENCE_FLOOR`                  |
| Files — components            | `PascalCase.tsx`            | `RecipeCard.tsx`                    |
| Files — everything else       | `kebab-case.ts`             | `score-recipe.ts`                   |
| Routes (expo-router)          | `kebab-case`                | `app/(tabs)/pantry.tsx`             |
| Booleans                      | `is` / `has` / `can` prefix | `hasAllergen`                       |

No `I` prefix on interfaces. No `T` prefix on types. Hungarian notation died for a reason.

### 2.3 Types

**Never `any`.** Use `unknown` at boundaries and narrow it. `any` disables the compiler at exactly the point you most need it.

```ts
// No.
function parse(data: any) {
  return data.ingredients;
}

// Yes — validate at the boundary, and everything downstream is typed for free.
function parse(data: unknown): Ingredient[] {
  return IngredientArraySchema.parse(data);
}
```

Prefer `type` for unions and object shapes; use `interface` only when declaration merging is genuinely needed (rare).

Use discriminated unions instead of optional-field soup:

```ts
// No — four impossible states are representable.
type Result = { ok?: boolean; data?: Recipe[]; error?: string };

// Yes — the compiler enforces that you handle both cases.
type Result = { status: 'ok'; data: Recipe[] } | { status: 'error'; message: string };
```

`as const` for literal arrays and config objects. `satisfies` when you want checking without widening.

### 2.4 Functions

- One job per function. If the name needs "and," split it.
- Prefer pure functions, especially in `src/engine/`.
- Named exports only. No default exports — they make renames invisible and grep useless. (The one exception: expo-router route files, which the framework requires to default-export.)
- Destructure parameters when there are more than two.
- Return early; do not nest.

```ts
// No.
function bucket(missing: number) {
  if (missing === 0) {
    return 'ready';
  } else {
    if (missing <= 2) {
      return 'missing_few';
    } else {
      if (missing <= 4) {
        return 'missing_some';
      } else {
        return 'grocery_run';
      }
    }
  }
}

// Yes.
function bucket(missing: number): Bucket {
  if (missing === 0) return 'ready';
  if (missing <= 2) return 'missing_few';
  if (missing <= 4) return 'missing_some';
  return 'grocery_run';
}
```

### 2.5 React and React Native

- Function components only.
- Hooks at the top, then derived values, then handlers, then JSX. Same order in every file — so any of us can scan any component.
- One component per file. If a file exceeds ~150 lines, it is doing too much.
- Server state → **TanStack Query**. Client state → **Zustand**. Never `useState` for data that came from Supabase.
- No inline styles in JSX. Use `StyleSheet.create` at the bottom of the file, or design tokens.
- **Accessibility props are required on every interactive element.** ESLint enforces this. A missing `accessibilityLabel` fails CI — it is not a review comment, it is a build break.

```tsx
export function IngredientChip({ ingredient, onRemove }: IngredientChipProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const label = formatIngredient(ingredient);

  const handleRemove = useCallback(async () => {
    setIsRemoving(true);
    await onRemove(ingredient.id);
  }, [ingredient.id, onRemove]);

  return (
    <Pressable
      onPress={handleRemove}
      disabled={isRemoving}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${label}. Remove from pantry.`}
      accessibilityHint="Removes this ingredient and updates your meal suggestions"
      style={styles.chip}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
```

### 2.6 Async and errors

- `async`/`await` only. No raw `.then()` chains.
- Never swallow an error. Either handle it or let it propagate.
- Every user-visible async operation has a loading state and an error state. "It just spins forever" is a bug, not an edge case.
- Edge Functions: CORS preflight first, CORS headers on error responses (Technical Spec §6).

### 2.7 Imports

Ordered, with blank lines between groups (auto-sorted by ESLint):

```ts
import { useCallback, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { useQuery } from '@tanstack/react-query';

import { decide } from '@/engine/decide';
import type { Ingredient } from '@/types/pantry';

import { styles } from './styles';
```

Absolute imports via `@/` for anything outside the current directory. `../../../` is a code smell about file placement.

---

## 3. Python Standard — PEP 8

Applies to `tools/catalog/` and any future scripts. **PEP 8 is the baseline; everything below either restates the parts that matter most or resolves a choice PEP 8 leaves open.**

### 3.1 Tooling

| Tool       | Role                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------- |
| **Ruff**   | Formatter _and_ linter. Replaces Black + isort + Flake8, and is fast enough to run on save. |
| **mypy**   | Static type checking, `strict` mode                                                         |
| **pytest** | Testing                                                                                     |

```toml
# tools/catalog/pyproject.toml
[project]
name = "homechef-catalog"
requires-python = ">=3.12"

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "B", "SIM", "ANN"]
# E/W: pycodestyle (PEP 8)   F: pyflakes      I: import sorting
# N:   PEP 8 naming          UP: pyupgrade    B: bugbear
# SIM: simplify              ANN: require annotations

[tool.mypy]
strict = true
warn_return_any = true
```

### 3.2 Layout (PEP 8)

- **4 spaces** per indent level. Never tabs.
- **Two blank lines** between top-level definitions; **one** between methods.
- **100-character** lines (PEP 8 permits relaxing the historical 79 by team agreement; we do, and we hold it consistent with TypeScript).
- Imports at the top of the file, one per line, in three groups separated by blank lines: **standard library → third party → local**. Ruff enforces the ordering.
- Absolute imports. No wildcard imports, ever.
- Surround binary operators with a single space. No space immediately inside brackets or before a comma.
- No trailing whitespace. Files end with exactly one newline.

```python
import json
import logging
from pathlib import Path

import httpx
from pydantic import BaseModel

from catalog.normalize import canonical_ingredient_id
```

### 3.3 Naming (PEP 8)

| Kind                 | Convention                  | Example                           |
| -------------------- | --------------------------- | --------------------------------- |
| Modules, packages    | `lowercase` or `snake_case` | `normalize.py`                    |
| Functions, variables | `snake_case`                | `fetch_all_recipes`               |
| Classes, exceptions  | `PascalCase`                | `RecipeRecord`, `EnrichmentError` |
| Constants            | `SCREAMING_SNAKE_CASE`      | `SOURCE_ARCHIVE_URL`              |
| Internal / private   | leading underscore          | `_retry_with_backoff`             |
| Type variables       | `PascalCase`, short         | `T`, `RecipeT`                    |

Never use `l`, `O`, or `I` as single-character names — indistinguishable from `1` and `0` in many fonts. This is in PEP 8 and it is there for a reason.

### 3.4 Type hints — required

Every function signature is fully annotated. Enforced by Ruff `ANN` and mypy `strict`.

```python
def enrich_equipment(instructions: str, client: LLMClient) -> list[Equipment]:
    """Extract required equipment from free-text cooking instructions.

    Returns an empty list when the model cannot determine equipment, which the
    decision engine treats as "no special equipment" rather than as a failure.
    """
```

Modern generics: `list[str]`, `dict[str, int]`, `str | None`. Not `List`, `Dict`, `Optional`.

### 3.5 Docstrings vs comments

Different tools for different jobs, and the distinction matters:

- **Docstrings** describe the public contract — what a function does, what it returns, what it raises. Every public function, class, and module gets one. Triple double quotes, imperative mood, summary line under 80 characters.
- **Inline comments** explain _why_, per §1.2, and are rare.

```python
def parse_measurement(raw: str) -> Measurement:
    """Parse an archive measurement string into quantity and unit.

    Raises:
        MeasurementParseError: when no numeric quantity can be recovered.
    """
    # Source measurements are hand-entered and inconsistent: "1 cup",
    # "1/2 tsp", "a pinch", "2 1/2 tbsp", "". Regex handles the numeric forms;
    # everything else falls through to the qualitative lookup table below.
    ...
```

Do **not** write Args/Returns blocks that merely restate the type hints. The signature already says it. Document what the signature cannot: units, raised exceptions, edge-case behavior, side effects.

### 3.6 Idioms

- Pathlib over `os.path`. `Path("src/data") / "recipes.json"`.
- Context managers for every resource. Never a bare `open()`.
- f-strings for formatting. Not `%` and not `.format()`.
- Comprehensions when they fit on one line and read cleanly; an explicit loop otherwise. A nested triple comprehension is not clever, it is a rereading tax.
- `logging`, never `print()`, in anything that isn't a CLI entry point.
- Pydantic models for archive records and LLM outputs. Validate at the boundary,
  exactly as Zod does on the TypeScript side.
- Catch specific exceptions. A bare `except:` swallows `KeyboardInterrupt` and hides real bugs.

---

## 4. SQL Standard

- Keywords lowercase (`select`, not `SELECT`) — matches Supabase's generated migrations.
- `snake_case` for tables and columns. Tables plural (`inventory`, `households`); columns singular.
- Timestamps are `timestamptz`, never `timestamp`.
- Every migration is forward-only and named `NNNN_short_description.sql`.
- **Every table has RLS enabled in the same migration that creates it.** Not a follow-up.
- Explicit column lists in application queries. `select *` breaks silently when a column is added.

---

## 5. Git Conventions

### 5.1 Commit messages

**Subject line: imperative present tense, under 50 characters, capitalized, no trailing period.**

The imperative mood is not arbitrary — it matches Git's own generated messages ("Merge branch...", "Revert..."). The test: your subject line should complete the sentence _"If applied, this commit will \____."_

| Good                                      | Bad                                                                 | Why the bad one fails            |
| ----------------------------------------- | ------------------------------------------------------------------- | -------------------------------- |
| `Add equipment filter to decision engine` | `Added equipment filter`                                            | Past tense                       |
| `Fix bucket boundary off-by-one`          | `fixes bug`                                                         | Not imperative, vague, lowercase |
| `Refactor pantry sync to use upsert`      | `Refactoring the pantry sync logic to use upsert instead of insert` | 68 chars, present participle     |
| `Extract IngredientChip component`        | `misc changes`                                                      | Says nothing                     |
| `Remove barcode scanning scaffold`        | `updates`                                                           | Says nothing                     |

Verbs we use: `Add` · `Fix` · `Remove` · `Refactor` · `Update` · `Rename` · `Move` · `Extract` · `Document` · `Test` · `Bump`

**Body** (optional, wrapped at 72 characters, separated from the subject by a blank line) explains _why_, never _what_ — the diff already shows what:

```
Cut wake-word detection from launch scope

Continuous audio streaming through SFSpeechRecognizer causes thermal
throttling on iPhone 12 and older after roughly 8 minutes. Tap-to-listen
ships for Aug 24; Porcupine wake-word is queued for Phase 2.

Refs: Technical Spec 2.5
```

Reference the Notion ticket where one exists.

### 5.2 Branch names

`<type>/<short-description>` in kebab-case:

```
feat/equipment-filter
fix/bucket-boundary
chore/bump-expo-57
docs/technical-spec
```

Types: `feat` · `fix` · `chore` · `docs` · `refactor` · `test`

### 5.3 What never enters the repository

- Secrets, API keys, `.env` files. GitHub push protection is on.
- `node_modules/`, build artifacts, `.expo/`, `__pycache__/`.
- Commented-out code.
- Personal editor config beyond the committed `.vscode/settings.json`.

`src/data/recipes.json` and `src/data/ingredients.json` are committed
transitional artifacts. They are frozen and non-rebuildable from the retired
provider, so their checksums protect them from drift. Source-neutral catalog
release artifacts are reproducible from approved, checksum-pinned archives.

---

## 6. Enforcement

| Gate                         | Runs            | Blocks merge |
| ---------------------------- | --------------- | ------------ |
| Prettier / Ruff format       | pre-commit + CI | Yes          |
| ESLint / Ruff lint           | pre-commit + CI | Yes          |
| `tsc --noEmit` / mypy strict | CI              | Yes          |
| Unit tests                   | CI              | Yes          |
| Accessibility lint rules     | CI              | Yes          |
| Secret scanning              | push            | Yes          |
| Human review                 | PR              | Yes          |

**If a rule in this document is not enforced by a tool, it is a suggestion — and we should either automate it or delete it.** Review time is our scarcest resource; spending it on formatting is malpractice.

---

## 7. Amending this guide

This is a living document. To change a rule: open a PR against this file, state the reasoning, get the other founder's approval, merge. Do not litigate style in a code review — fix the code to match the guide, then open a separate PR to change the guide if you think it is wrong.

---

_Application42 · HomeChef · Shared Style Guide v1.0 · August 3, 2026_
