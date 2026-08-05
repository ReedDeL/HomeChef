# HomeChef — Collaborative Tools & Workflow Blueprint

**Company:** Application42 · **Product:** HomeChef
**Version:** 1.0 · **Date:** August 3, 2026
**Launch:** August 24, 2026 · **Go/No-Go:** August 9, 2026

---

## 0. The problem this solves

Three people, twenty-one days, and — per the team's own status report — no reliable in-person overlap. Every hour spent waiting on someone else is an hour of a 504-hour runway.

**Design principle: optimize for asynchronous unblocking.** Every process below exists to answer one of three questions without a meeting:

1. What should I work on right now?
2. Is this finished?
3. Who decides?

---

## 1. Role Boundaries

Clear ownership prevents the two failure modes of a small founding team: duplicated work, and work nobody picked up because both assumed the other had it.

| | **RJ — CEO** | **Harshal — CTO** | **Third seat** |
|---|---|---|---|
| **Owns** | Business development, marketing engineering, agentic engineering, tech sales, product & project management, overall planning and context | Software engineering, prompt engineering, iOS/Xcode, technical architecture, code correctness | To be assigned at kickoff — see §1.2 |
| **Decides alone** | Scope cuts, launch date, positioning, pricing, vendor purchases, ticket priority | Architecture, library choices, data model, code structure, merge approval | — |
| **Cannot decide alone** | Architecture, data model | Scope, launch date, anything with a recurring cost | — |
| **Launch-blocking tasks** | API keys into Supabase (Aug 4), TheMealDB supporter payment (Aug 17), App Store submission (Aug 17), Supabase keep-alive (Aug 20) | Tier 1 catalog pipeline + equipment enrichment (Aug 9), photo→pantry pipeline, decision engine, Spoonacular Tier 2 + quota guard | — |

### 1.1 Escalation

Any decision that touches **both** scope and architecture requires both founders. There are exactly three of these in the current plan, and all three are already scheduled:

- The **August 9 go/no-go** on cook mode.
- Turning on **Spoonacular** (adds cost + architecture).
- Any change to **allergen filtering** — a safety path, and the one place we deliberately accept slower velocity.

Everything else: **the owner decides and posts the decision.** Waiting for consensus on a reversible decision is the most expensive habit a small team can have. Distinguish the two:

- **Reversible** (a library, a component structure, a color): decide, ship, post it.
- **Irreversible** (the database, the launch date, a payment): both founders.

### 1.2 The third seat

Currently unassigned in the source documents. Recommended focus, in priority order given the risk register:

1. **QA and manual testing** — including the mandatory 30-recipe equipment spot-check (Technical Spec §5.2), which is a two-person job if it is going to be honest.
2. **Accessibility auditing** — Accessibility Inspector and Accessibility Scanner passes, which are a DoD gate and will otherwise get skipped under deadline pressure.
3. **Content and catalog QA** — recipe data correctness, ingredient normalization review.

Assign this before the first sprint. An unassigned third of the team on day one of a 21-day sprint is a compounding loss.

---

## 2. Source Control — GitHub Flow

**Model:** GitHub Flow. Not Git Flow, not trunk-based-with-flags.

**Why:** Git Flow's `develop`/`release`/`hotfix` branch hierarchy exists to coordinate scheduled releases across large teams. We are three people shipping continuously to one target. That overhead buys us nothing and costs us merges. Trunk-based development, at the other extreme, assumes a mature CI suite and feature-flag infrastructure we do not have time to build.

GitHub Flow is the right middle: **`main` is always deployable, and everything else is a short-lived branch behind a pull request.**

### 2.1 The loop

```
  main (always deployable, always green)
    │
    ├──● branch          feat/equipment-filter
    │   │
    │   ├──● commit      imperative, <50 chars
    │   ├──● commit
    │   │
    │   ├──● push        early — a pushed branch is visible work
    │   │
    │   ├──◆ Pull Request opened
    │   │     ├─ CI: format · lint · types · tests · a11y
    │   │     └─ Peer review
    │   │
    │   └──◆ Merge (squash) ──▶ main ──▶ auto-deploy preview
    │
    └──● branch          fix/bucket-boundary
```

### 2.2 Rules

1. **`main` is always deployable.** If `main` is red, fixing it is the highest-priority task for whoever broke it. Everything else stops.
2. **Never commit directly to `main`.** Branch protection enforces this. It applies to founders too — especially to founders, at 1am, three days before launch.
3. **Branch from `main`, name it per the Style Guide** (`feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`).
4. **Push early.** Open a draft PR on the first push. A branch nobody can see is a branch nobody can help with — and in an async team, invisible work gets duplicated.
5. **Keep PRs small.** Target under 400 changed lines. Review quality falls off a cliff past that; large PRs get rubber-stamped, which is worse than no review at all. If a feature is inherently large, land it in stacked PRs behind an unexported module.
6. **One approval required to merge.** From the other founder.
7. **Squash on merge.** `main` history stays one-commit-per-change and readable. The squash commit message follows the Style Guide subject rules.
8. **Delete the branch on merge.** Automatic.
9. **Rebase on `main` before merging** if the branch is more than a day old.

### 2.3 Pull request template

```markdown
## What
One sentence. Same imperative mood as a commit subject.

## Why
The problem this solves. Link the Notion ticket.

## How to verify
Exact steps a reviewer follows to confirm it works.

## Checklist
- [ ] Definition of Done met (see §4)
- [ ] Tests added or updated
- [ ] Accessibility props on new interactive elements
- [ ] No secrets, no commented-out code
- [ ] Self-reviewed the diff
```

### 2.4 Review standard

**Review for correctness, structure, and naming. Nothing else.** Formatting is the formatter's job (Style Guide §1.1) — a review comment about whitespace means the tooling is misconfigured, and that is the actual bug to fix.

**Reviewer commits to responding within 12 hours.** In an async team, a stalled review is a stalled teammate. If you cannot review within 12 hours, say so in the PR so the author can decide whether to wait or find another reviewer.

Comment conventions — prefix every comment so the author knows what is binding:

- **`blocking:`** — must change before merge. Correctness, security, a DoD violation.
- **`suggestion:`** — worth considering, author decides. Non-blocking.
- **`question:`** — I don't understand this; explain or clarify the code.
- **`nit:`** — trivial, feel free to ignore. Use these sparingly; too many nits drown the blocking comments.

**Approve with unresolved `suggestion:` and `nit:` comments.** Blocking on preferences is how a three-person team invents bureaucracy.

### 2.5 Repository settings

| Setting | Value |
|---|---|
| Default branch | `main` |
| Branch protection on `main` | Require PR · require 1 approval · require CI green · no force push |
| Secret scanning + push protection | Enabled |
| Auto-delete merged branches | Enabled |
| Merge method | Squash only (rebase and merge-commit disabled) |

---

## 3. Task Tracking — Notion Board

**Tool: Notion.** The team's existing `Project Management` database already has the exact three-column status model (`Not started` / `In progress` / `Done`) and a `By Status` board view. Migrating to Jira 21 days from launch would cost setup time and split the team's context across two tools for no gain — the status reports, product vision, and technicalities pages all live in Notion already.

The three-column model specified in the brief maps directly:

| Brief | Notion `Status` | Means |
|---|---|---|
| **To Do** | `Not started` | Defined, unblocked, ready to pick up |
| **In Progress** | `In progress` | Someone is actively working it — assignee set |
| **Done** | `Done` | Definition of Done fully met (§4) |

### 3.1 Column discipline

The columns are worthless without rules about what may enter them.

**Entry into `Not started`:**
- Has a clear, outcome-shaped title (`Add equipment filter to results`, not `equipment stuff`)
- Has an assignee
- Has a priority (High / Medium / Low)
- Is genuinely unblocked — if it is waiting on something, note the blocker in the ticket body
- Is small enough to finish in under two days. Bigger than that, split it.

**Entry into `In progress`:**
- Work has actually started, today
- **A person holds at most 2 cards here at once.** This is the single most important rule on the board. Work-in-progress limits are what convert a task board from a wish list into a scheduling tool. Three people × 2 = 6 cards maximum in flight.
- If you are blocked, move the card **back** to `Not started` with the blocker noted. Do not leave it parked in `In progress` — that hides the block from your teammates, which in an async team means it stays hidden for a day.

**Entry into `Done`:**
- **Every** Definition of Done item met. No partial credit. `Done` means shippable.

### 3.2 Fields

Using the existing schema:

| Field | Use |
|---|---|
| **Project name** | Imperative outcome. Mirrors commit style. |
| **Status** | The three columns |
| **Assignee** | Exactly one person. Shared ownership is no ownership. |
| **Priority** | `High` = blocks Aug 24 · `Medium` = launch scope, has slack · `Low` = post-launch |
| **Start date / End date** | Drives the existing Gantt view — critical with a fixed deadline |
| **Team** | Existing options repurposed: `Product Design` = engineering/UX work · `Business Development` = RJ's launch-blocking commercial tasks |

### 3.3 Async cadence

No standing meetings. Three lightweight rituals instead:

| Ritual | When | Format | Owner |
|---|---|---|---|
| **Daily written check-in** | By 10am, in the Notion `Status Reports` table | Done since last / doing today / blocked by | Each person |
| **Blocker escalation** | Immediately, always | Move card back, tag the other founder in the ticket | Whoever is blocked |
| **Go/No-Go review** | Aug 9 | Synchronous — 30 min. The only required meeting before launch. | RJ |

The `Status Reports` table already exists and is in use (entries on Aug 1 and Aug 2). We are formalizing a habit the team already has rather than introducing a new one — which is why it will actually stick.

### 3.4 Board hygiene

- Update your card's status **when the state changes**, not at end of day. A stale board is worse than no board, because it produces confident wrong decisions.
- If a card sits in `In progress` more than 3 days, it was too big. Split it.
- Every `High` priority card maps to a risk in Technical Spec §8 or to the MVP scope in §1.1. If it maps to neither, it is not `High`.

---

## 4. Definition of Done

**Binding and non-negotiable.** A card moves to `Done` only when every applicable box is checked. "Done except for tests" is not done — it is a card in `In progress` wearing a disguise.

### 4.1 The checklist

**Functional**
- [ ] Meets every acceptance criterion in the ticket
- [ ] Manually verified on **iOS and web** (Android best-effort for launch)
- [ ] Loading state and error state both exist and both work
- [ ] Empty state handled — and for anything touching the decision engine, **never a dead-end screen** (Technical Spec §4.3)

**Code quality**
- [ ] Style Guide followed; formatter and linter clean
- [ ] `tsc --noEmit` / mypy strict passes with no errors
- [ ] No `any`, no `TODO` without an owner, no commented-out code
- [ ] No secrets committed

**Testing — automated, non-negotiable**
- [ ] Unit tests for all new logic in `src/engine/` — this is pure and has no excuse for being untested
- [ ] Tests cover the happy path **and** at least one failure or boundary case
- [ ] Full suite green in CI
- [ ] Any bug fix includes a regression test that fails without the fix

**Review — non-negotiable**
- [ ] PR opened with the template filled in
- [ ] **One approval from the other founder**
- [ ] All `blocking:` comments resolved
- [ ] Reviewer confirms the "how to verify" steps actually work

**Accessibility**
- [ ] `accessibilityLabel` on every new interactive element
- [ ] `accessibilityRole` set correctly
- [ ] Touch targets ≥44×44pt (≥64×64pt in cook mode)
- [ ] Contrast meets WCAG 2.1 AA
- [ ] Screen-reader pass on any new screen

**Deployment — non-negotiable**
- [ ] Merged to `main`
- [ ] CI green on `main` after merge
- [ ] **Deployed to the preview build and confirmed working there** — not just on the author's machine
- [ ] Any database migration applied to the Supabase project
- [ ] Any new RLS policy verified with a second test account

**Third-party data — for anything touching Spoonacular**
- [ ] No Spoonacular field beyond `id`, `title`, `imageUrl` is written to Postgres
- [ ] Source attribution rendered on any Tier 2 recipe shown
- [ ] HTTP 402 handled as normal degradation, not an error screen
- [ ] Quota impact of the change estimated and noted in the PR

**Documentation**
- [ ] User-facing change reflected in the Notion status report
- [ ] Architectural change reflected in `docs/01_TECHNICAL_SPEC.md`
- [ ] New environment variable documented in `.env.example`

### 4.2 The three that never bend

Under deadline pressure, teams cut the last thing on the checklist. So these are named explicitly as the ones that do not move:

1. **Automated testing** on `src/engine/` — it is a pure function, tests take minutes, and a bucketing bug is invisible in manual testing but ships wrong answers to every user.
2. **Code review passing** — with two engineers, review is the only defense against a single bad merge on August 23.
3. **Successful deployment** — "works locally" has never once been true when it mattered.

### 4.3 Living document

Amend by PR against this file with both founders' approval. Expected amendment after the Aug 9 gate: tighten or relax the accessibility section depending on whether cook mode ships.

**One standing exception, defined in advance:** a production-down hotfix may merge with a post-hoc review, provided the review happens within 24 hours and a regression test lands with it. This exception exists so that nobody has to invent a policy at 2am — and it is the only exception.

---

## 5. CI/CD

GitHub Actions on every PR and every push to `main`:

```yaml
name: ci
on: [pull_request, push]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx prettier --check .
      - run: npx eslint .
      - run: npx tsc --noEmit
      - run: npm test -- --coverage

  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install ruff mypy pytest
      - run: ruff format --check tools/
      - run: ruff check tools/
      - run: mypy --strict tools/catalog
      - run: pytest tools/
```

**Deployment:** Expo EAS builds on merge to `main`. Web deploys automatically; iOS and Android go to internal test channels. OTA updates for JS-only fixes post-launch — this is our launch-day insurance policy (Technical Spec §2.1).

---

## 6. Communication

| Channel | Use | Response expectation |
|---|---|---|
| **Notion status table** | Daily check-ins, decisions, context | Read daily |
| **GitHub PR comments** | Anything about specific code | 12 hours |
| **Notion ticket comments** | Anything about specific work | 12 hours |
| **Direct message** | Genuinely blocking, needs an answer now | Fast — use sparingly, or it stops meaning anything |
| **Synchronous call** | Aug 9 go/no-go, and true emergencies only | Scheduled |

**Write decisions down where the work lives.** A decision made in a DM does not exist — the third teammate never sees it, and neither does the version of you debugging this in November. Decision → the relevant Notion page or `docs/` file.

---

## 7. The 21-Day Critical Path

```
Aug 3   ─┬─ Specs approved · repo initialized · board populated
         │
Aug 4-8 ─┼─ Harshal: Tier 1 catalog pipeline + equipment enrichment  ◀── R2
         │  RJ: onboarding flow · Supabase schema + RLS · API keys
         │
Aug 9   ─┼─ ★ GO / NO-GO ── does a real dorm pantry bucket correctly
         │     using TIER 1 ALONE? (Tier 2 is best-effort, can't be the test)
         │     GO    → build cook mode with voice
         │     NO-GO → plain recipe page, protect Aug 24
         │
Aug 10-16┼─ Photo→pantry pipeline · decision engine · results screen
         │  Spoonacular Tier 2 Edge Function + quota guard
         │  Recipe page · pantry management · like/dislike · attribution
         │
Aug 17  ─┼─ ★ TheMealDB supporter payment  (R4, hard blocker)
         │  ★ App Store submission          (R6, review latency)
         │
Aug 18-22┼─ Accessibility audit · bug fixes · real-user testing
         │
Aug 20  ─┼─ ★ Supabase keep-alive or Pro upgrade  (R5)
         │
Aug 23  ─┼─ Feature freeze. Fixes only.
         │
Aug 24  ─┴─ ★ LAUNCH
```

**Feature freeze on August 23 is absolute.** The last day before launch is for verification, not for one more feature. Anything not merged by end of day August 22 ships in the first OTA update instead.

---

## 8. Tool Summary

| Function | Tool | Owner |
|---|---|---|
| Source control | GitHub — GitHub Flow | Harshal |
| Task tracking | Notion `Project Management` board | RJ |
| Documentation | Notion + `docs/` in repo | RJ |
| CI/CD | GitHub Actions + Expo EAS | Harshal |
| Backend | Supabase | RJ (account) / Harshal (schema) |
| Editor | VS Code, committed workspace settings | Both |
| iOS builds | Xcode | Harshal |
| AI assistance | See `05_AI_TOOLING_PLAYBOOK.md` | Both |

---

*Application42 · HomeChef · Collaborative Tools & Workflow Blueprint v1.0 · August 3, 2026*
