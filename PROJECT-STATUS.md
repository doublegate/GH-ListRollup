# Project Status

**Last updated:** 2026-11-16 | **Version:** 0.1.0 (unreleased) | **Phase:** 0, Foundation

## Summary

The project has been bootstrapped. The research, specifications and plan are written, and a WXT +
TypeScript skeleton builds for Chrome and Firefox and passes every local gate. Nothing user-visible
is implemented yet. Phase 0 Sprint 1 is complete. The skeleton was verified on live GitHub in Chrome
and Firefox: page detection, soft navigation and extension reload (T-GNR-004). Next is fixture
tooling (Phase 0 Sprint 2).

## Phases

| Phase                     | Status                                                   |
| ------------------------- | -------------------------------------------------------- |
| 0 Foundation              | In progress: Sprint 1 complete; Sprint 2 (fixtures) next |
| 1 Listing collapse        | Planned                                                  |
| 2 Inline tree             | Planned                                                  |
| 3 Settings and resilience | Planned (stub-level tickets)                             |
| 4 Testing and hardening   | Planned (stub-level tickets)                             |
| 5 Release                 | Planned (stub-level tickets)                             |

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
| Unit tests          | 15 passing                      | `pnpm test`, 2026-11-15                    |
| Lint / typecheck    | clean, zero warnings            | `pnpm lint`, `pnpm typecheck`, 2026-11-15  |
| `web-ext lint`      | 0 errors, 0 warnings, 0 notices | `pnpm lint:firefox`, 2026-11-15            |
| Content script size | 4.64 kB                         | `pnpm build` output, 2026-11-15            |
| CI                  | Green on first push             | GitHub Actions run 43806484751, 2026-11-15 |

## Known issues

- deepmerge (GHSA-gcqx-w48m-w2h4, low) has no fixed release. It is dev-time only and reviewed; see
  `docs/build-and-tooling.md` §4.
- Every github.com observation so far was made logged out. Logged-in markup and private-repo data
  access remain unverified (T-GNR-012, T-GNR-201).

## Next steps

1. Phase 0 Sprint 2: fixture capture tooling (T-GNR-011 to T-GNR-014).
2. Later, during T-GNR-106: instrument which event triggers detection in Firefox (`navigate` vs
   WXT's polling fallback). Detection itself already works there.
