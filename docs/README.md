# HomeChef — documentation index

**Company:** Application42 · **Product:** HomeChef · **Launch:** August 24, 2026

## Start here

| Document                                                                  | Use it for                                                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Owned catalog design](specs/2026-08-22-owned-recipe-catalog-design.md)   | Rights, releases, hosted-plus-offline behavior, and transition rules |
| [Owned catalog roadmap](plans/2026-08-22-owned-recipe-catalog-roadmap.md) | Sequenced implementation and completion evidence                     |
| [Technical specification](01_TECHNICAL_SPEC.md)                           | Product architecture, safety constraints, and data model             |
| [Shared style guide](02_STYLE_GUIDE.md)                                   | TypeScript, Python, SQL, and commit conventions                      |
| [Collaboration blueprint](03_COLLABORATION_BLUEPRINT.md)                  | Review and Definition of Done                                        |
| [UI/UX specification](04_UIUX_SPEC.md)                                    | Screen behavior, accessibility, and attribution                      |
| [AI tooling playbook](05_AI_TOOLING_PLAYBOOK.md)                          | Safe AI-assisted work                                                |
| [API keys and environment](06_API_KEYS_AND_ENV.md)                        | Public variables, secrets, and operational boundaries                |
| [../AGENTS.md](../AGENTS.md)                                              | Repository-wide instructions                                         |

## Retained feature documents

- [Microwave seed catalog design](specs/2026-08-06-microwave-seed-catalog-design.md)
- [Photo-to-pantry design](specs/2026-08-07-photo-to-pantry-design.md)
- [Web webcam capture design](specs/2026-08-10-web-webcam-capture-design.md)
- [Google OAuth Android/web design](specs/2026-08-12-google-oauth-android-web-design.md)
- [Responsive web layout design](specs/2026-08-12-responsive-web-layout-design.md)
- [Google OAuth Android/web plan](plans/2026-08-12-google-oauth-android-web.md)

The existing provider-derived bundle is transitional, non-rebuildable, and
still attributed while it ships. The current release has 812 recipes, 897
ingredients, and 76 excluded `unclassified` recipes; replacement parity is the
gate for removing it.
