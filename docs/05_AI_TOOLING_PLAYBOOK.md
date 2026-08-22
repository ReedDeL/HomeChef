# HomeChef — AI Tooling Playbook

## Ownership rule

AI can accelerate focused work, but the author owns every line merged. Read the
relevant design, nearby code, and tests before asking for implementation. Review
the diff, challenge new abstractions, and verify the result with evidence.

## Required context

- [AGENTS.md](../AGENTS.md) is the repository-wide context source.
- [Technical specification](01_TECHNICAL_SPEC.md) defines architecture and
  safety constraints.
- [Owned catalog design](specs/2026-08-22-owned-recipe-catalog-design.md)
  governs catalog work.
- [Style guide](02_STYLE_GUIDE.md) governs code and commit shape.

Give an agent a bounded outcome, relevant files, non-negotiable constraints,
and verification commands. Ask for the trade-offs before requesting a design
change. For production behavior, write or inspect the test first.

## Catalog-specific guardrails

- Do not ask an agent to introduce a recipe-provider API, key, endpoint, quota
  guard, live fallback, or tier semantic.
- Do not describe the transitional `src/data/*.json` bundle as already removed
  or as rebuildable. It is provider-derived, non-rebuildable, and attributed
  until approved replacement parity.
- Require source-neutral models, approved checksum-pinned manifest entries,
  provenance, quarantine reasons, deterministic output, and active attribution.
- Preserve the pure engine boundary: the engine takes `Recipe[]` and does not
  know hosted from offline data.
- Require unknown equipment, allergen, and dietary status to exclude. Hard
  constraints never relax.
- Do not authorize remote source downloads, migrations, catalog loads, or
  activation through a generic implementation prompt.

## High-risk review areas

Review hard-constraint filtering, RLS, release activation, source-rights
validation, attribution, and photo-to-pantry boundaries manually. Gemini is
only for photo-to-pantry and its output is `unknown` until Zod validates it.
Never put secrets, real pantry images, user data, or service-role credentials in
a prompt.

## Slop test

Before handoff, ask:

1. Can I explain every changed line and its failure mode?
2. Does it match the repository's density and vocabulary?
3. Is it as small as the task allows?
4. Did verification prove the claimed behavior?

If any answer is no, revise before merge.
