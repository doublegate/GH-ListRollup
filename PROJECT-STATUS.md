# Project Status

**Last updated:** 2026-11-16 | **Version:** 0.1.0 (unreleased) | **Phase:** 1, Listing collapse (Phase 0 complete)

## Summary

The project has been bootstrapped. The research, specifications and plan are written, and a WXT +
TypeScript skeleton builds for Chrome and Firefox and passes every local gate. Nothing user-visible
is implemented yet. **Phase 0 is complete:**

- The skeleton was verified on live GitHub in Chrome and Firefox (T-GNR-004).
- Sanitized, reproducible GitHub fixtures exist for both page layouts, signed in and out, and for
  every tree-JSON case (Sprint 2).
- Signed-in markup turned out identical for every selector the extension uses.

Next is Phase 1 Sprint 1: the selectors module and page model.

## Phases

| Phase                     | Status                                   |
| ------------------------- | ---------------------------------------- |
| 0 Foundation              | Complete (2026-11-16)                    |
| 1 Listing collapse        | Next: Sprint 1, selectors and page model |
| 2 Inline tree             | Planned                                  |
| 3 Settings and resilience | Planned (stub-level tickets)             |
| 4 Testing and hardening   | Planned (stub-level tickets)             |
| 5 Release                 | Planned (stub-level tickets)             |

## Features

| Feature                         | Spec                         | Status                                                            |
| ------------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| Page-type detection (URL shape) | `docs/dom-integration.md` §3 | Done (T-GNR-003)                                                  |
| Soft-navigation wiring          | `docs/dom-integration.md` §4 | Done in skeleton form; verified in Chrome and Firefox (T-GNR-004) |
| Level 1: whole-listing collapse | `docs/ui-behavior.md` §2     | Not started (Phase 1)                                             |
| Level 2: inline folder tree     | `docs/ui-behavior.md` §3     | Not started (Phase 2)                                             |
| Settings and options page       | `docs/settings.md`           | Not started (Phase 3)                                             |

## Metrics

| Metric              | Value                           | Source                                     |
| ------------------- | ------------------------------- | ------------------------------------------ |
| Unit tests          | 53 passing                      | `pnpm test`, 2026-11-16                    |
| Lint / typecheck    | clean, zero warnings            | `pnpm lint`, `pnpm typecheck`, 2026-11-15  |
| `web-ext lint`      | 0 errors, 0 warnings, 0 notices | `pnpm lint:firefox`, 2026-11-15            |
| Content script size | 4.64 kB                         | `pnpm build` output, 2026-11-15            |
| CI                  | Green on first push             | GitHub Actions run 43806484751, 2026-11-15 |

## Known issues

- deepmerge (GHSA-gcqx-w48m-w2h4, low) has no fixed release. It is dev-time only and reviewed; see
  `docs/build-and-tooling.md` §4.
- Private-repository access through the same-origin tree JSON is still unverified (T-GNR-201).
  Signed-in markup is verified identical (T-GNR-012).
- The server renders at most 100 listing rows; React is expected to add the rest after hydration.
  Not yet observed live (T-GNR-106).

## Next steps

1. Phase 1 Sprint 1: selectors module, `probe()`, DOM-backed page model and header-line locator
   (T-GNR-101 to T-GNR-104).
2. Later, during T-GNR-106: instrument which event triggers detection in Firefox (`navigate` vs
   WXT's polling fallback). Detection itself already works there.
