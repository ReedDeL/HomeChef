# HomeChef — documentation index

**Company:** Application42 · **Product:** HomeChef · **Launch:** August 24, 2026

This file is an index. It deliberately does not summarize the documents it
points at — a summary that drifts from its source is worse than no summary.

---

## Start here

| # | Document | Read if you are... |
|---|---|---|
| 01 | [Technical Specification](01_TECHNICAL_SPEC.md) | Making any technical decision — the core document |
| 02 | [Shared Style Guide](02_STYLE_GUIDE.md) | Writing code |
| 03 | [Collaboration Blueprint](03_COLLABORATION_BLUEPRINT.md) | Working with the team — process, roles, schedule |
| 04 | [UI/UX Specification](04_UIUX_SPEC.md) | Building a screen |
| 05 | [AI Tooling Playbook](05_AI_TOOLING_PLAYBOOK.md) | Using AI to build faster |
| 06 | [API Keys & Environment](06_API_KEYS_AND_ENV.md) | Setting up any third-party service — **read before coding** |
| — | [iPhone Web Testing Guide](HOW_TO_TEST_IPHONE_WEB.md) | Testing on iOS Safari |
| — | [`../AGENTS.md`](../AGENTS.md) | A coding agent (loaded automatically; `CLAUDE.md` symlinks to it) |

**RJ, read first:** 03 (process, roles, critical path) → 01 §8 (risk register)
→ 04 (product surface).

**Harshal, read first:** 01 (all of it) → 02 (standards) → 05 §5 (the equipment
prompt you own).

---

## Feature documentation

| Folder | Contents | Lifetime |
|---|---|---|
| [`specs/`](specs/) | One design per feature — the problem, the decision, and why. Each carries a `**Status:**` header naming the code that implements it. | Permanent. This is the decision record. |
| [`plans/`](plans/) | Task-by-task implementation plans for work in flight. | **Delete on merge.** A plan for shipped code is scaffolding left standing. |

[`RESEARCH_spoonacular_evaluation.md`](RESEARCH_spoonacular_evaluation.md) is a
retained decision record for the two-tier catalog choice (Aug 3, 2026).

---

## Where things live

| Question | Answer |
|---|---|
| What are we building, and with what? | Technical Spec §1–2 |
| What is the schedule? | Collaboration Blueprint §7 — and the Notion board for live status |
| What are the risks? | Technical Spec §8 (twelve, in full) |
| What is closed and must not be reopened? | [`../AGENTS.md`](../AGENTS.md) — the "Don't" list |
| What is done right now? | [`../README.md`](../README.md) — milestones and known gaps |

[`HomeChef_Executive_Summary.md`](HomeChef_Executive_Summary.md) is a
**point-in-time snapshot from August 3, 2026**, kept as a record of what was
decided at kickoff. Several of its decisions have since changed. Do not read it
for current state.

---

*Application42 · HomeChef*
