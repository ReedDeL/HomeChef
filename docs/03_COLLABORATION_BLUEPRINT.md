# HomeChef — Collaborative Tools & Workflow Blueprint

**Company:** Application42 · **Product:** HomeChef
**Version:** 0.1.0 · **Date:** August 3, 2026
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
| **Owns** | Business development, marketing engineering, automation engineering, tech sales, product & project management, overall planning and context | Software engineering, prompt engineering, iOS/Xcode, technical architecture, code correctness | To be assigned at kickoff — see §1.2 |
| **Decides alone** | Scope cuts, launch date, positioning, pricing, vendor purchases, ticket priority | Architecture, library choices, data model, code structure, merge approval | — |
| **Cannot decide alone** | Architecture, data model | Scope, launch date, anything with a recurring cost | — |
| **Launch-blocking tasks** | API keys into Supabase (Aug 4), TheMealDB supporter payment (Aug 17), App Store submission (Aug 17), Supabase keep-alive (Aug 20) | bundled catalog pipeline + equipment enrichment (Aug 9), photo→pantry pipeline, decision engine, Spoonacular expansion + quota guard | — |

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

1. Start from the repository's default branch (currently `master`).
2. Create one focused branch and keep unrelated worktree changes separate.
3. Open a draft pull request early when collaboration requires visibility.
4. Keep reviews small, require CI, and squash on merge.
5. Delete merged branches.

Branch naming and commit subjects follow the Style Guide. Repository settings,
not this document, are authoritative when they differ.

### 2.2 Rules

- One task per branch and one intentional change per commit.
- Never commit secrets, generated local state, or unrelated edits.
- Rebase before merge when the branch has drifted.
- Require another founder's approval for launch code.

### 2.3 Pull request content

Every pull request states what changed, why, exact verification steps, and any
remaining risk. The checklist is the Definition of Done in §4; do not maintain
a second embedded template.

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

The repository currently uses `master` as its default branch. Branch
protection, required checks, merge method, and secret scanning must be verified
in GitHub rather than copied into this document.

---

## 3. Task Tracking — Repository Work Queue

GitHub issues and pull requests are the repository-visible work queue. Each work item carries an outcome-shaped title, one owner, acceptance criteria, a status, and blockers. The repository and pull request are the source of truth for code changes; repository automation does not edit external workspaces.

### 3.1 Status discipline

- **Ready:** defined, unblocked, and small enough to finish in under two days.
- **In progress:** actively being worked today; each person holds at most two active items.
- **Blocked:** marked clearly with the dependency and owner of the next action.
- **Done:** every applicable Definition of Done item is met.

### 3.2 Issue fields

| Field | Use |
|---|---|
| Title | Imperative outcome that names the user or engineering result |
| Owner | Exactly one accountable person |
| Status | Ready, In progress, Blocked, or Done |
| Priority | High blocks launch; Medium is launch scope; Low is post-launch |
| Acceptance criteria | Observable behavior and verification requirements |
| Blocker | Dependency, decision, or missing access that prevents progress |

### 3.3 Async cadence

- Record a short daily check-in in the active issue or pull request: done, next, and blocked.
- Escalate blockers immediately in the issue or pull request that owns the work.
- Hold the scheduled go/no-go review only when a decision cannot be made asynchronously.

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
- [ ] Source attribution rendered on any Spoonacular recipe shown
- [ ] HTTP 402 handled as normal degradation, not an error screen
- [ ] Quota impact of the change estimated and noted in the PR

**Documentation**
- [ ] User-facing change reflected in the project change log
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

`.github/workflows/ci.yml` is the executable source of truth. It runs the
TypeScript quality suite, local Supabase RLS verification, Python formatting,
linting, typing, tests, and tracked-secret checks. Update the workflow and this
summary together when the gate changes.

---

## 6. Communication

| Channel | Use | Response expectation |
|---|---|---|
| **GitHub issue or pull request** | Code-specific work, review, blockers, and verification | 12 hours |
| **Repository decision record** | Durable product and architecture decisions | Before implementation |
| **Direct message** | Genuinely blocking questions that need an answer now | Fast; use sparingly |
| **Synchronous call** | Launch gate or true emergency only | Scheduled |

**Write decisions down where the work lives.** A decision made only in a direct message does not exist for the teammate debugging this in November. Put it in the relevant issue, pull request, or repository document.

## 7. Schedule and status

The launch checklist and repository change log are the daily status sources. This document defines process, not a second dated schedule. Launch remains August 24, 2026; feature-freeze and submission decisions belong in the relevant issue or decision record.

---

## 8. Tool Summary

| Function | Tool | Owner |
|---|---|---|
| Source control | GitHub Flow | Harshal |
| Task tracking | GitHub issues and pull requests | RJ |
| Documentation | Repository docs under docs/ | RJ |
| CI/CD | GitHub Actions and Expo EAS | Harshal |
| Backend | Supabase | RJ (account) / Harshal (schema) |
| Editor | VS Code and local workspace settings | Both |
| iOS builds | Xcode | Harshal |

*Application42 · HomeChef · Collaborative Tools & Workflow Blueprint v0.1.0 · August 3, 2026*
