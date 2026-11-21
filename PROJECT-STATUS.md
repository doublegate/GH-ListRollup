# Project Status

**Last updated:** 2026-11-16 | **Version:** 0.1.0 (unreleased) | **Phase:** 2, Inline tree (Phases 0 and 1 complete)

## Summary

The project has been bootstrapped. The research, specifications and plan are written, and a WXT +
TypeScript extension builds for Chrome and Firefox and passes every local gate. **Phase 0 is
complete:**

- The skeleton was verified on live GitHub in Chrome and Firefox (T-GNR-004).
- Sanitized, reproducible GitHub fixtures exist for both page layouts, signed in and out, and for
  every tree-JSON case (Sprint 2).
- Signed-in markup turned out identical for every selector the extension uses.

**Phase 1 is complete (2026-11-16), the first user-visible feature.** On every repository listing
page, the file listing starts collapsed to its header line, the latest-commit bar, with a chevron
toggle.

- It survives soft navigation and React re-renders, and resets to collapsed on each new listing.
- It never leaves files hidden without a toggle.
- It shows no flash on a cold load or an in-page navigation, measured frame by frame.
- It was verified live: Chromium automated, Firefox by the maintainer, including 20 consecutive
  navigations and high contrast. Next is Phase 2, the inline folder tree.

## Phases

| Phase                     | Status                       |
| ------------------------- | ---------------------------- |
| 0 Foundation              | Complete (2026-11-16)        |
| 1 Listing collapse        | Complete (2026-11-16)        |
| 2 Inline tree             | Next: Sprint 1, data layer   |
| 3 Settings and resilience | Planned (stub-level tickets) |
| 4 Testing and hardening   | Planned (stub-level tickets) |
| 5 Release                 | Planned (stub-level tickets) |

## Features

| Feature                         | Spec                         | Status                                                                                            |
| ------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Page-type detection (URL shape) | `docs/dom-integration.md` §3 | Done (T-GNR-003)                                                                                  |
| Soft-navigation wiring          | `docs/dom-integration.md` §4 | Done (Phase 1): lifecycle and navigation pre-hide (T-GNR-106, T-GNR-108), hardened in #19 and #20 |
| Level 1: whole-listing collapse | `docs/ui-behavior.md` §2     | Done (Phase 1): Chrome and Firefox, verified live                                                 |
| Level 2: inline folder tree     | `docs/ui-behavior.md` §3     | Not started (Phase 2)                                                                             |
| Settings and options page       | `docs/settings.md`           | Not started (Phase 3)                                                                             |

## Metrics

| Metric              | Value                           | Source                                     |
| ------------------- | ------------------------------- | ------------------------------------------ |
| Unit tests          | 279 passing                     | `pnpm test`, 2026-11-21 (#24)              |
| Lint / typecheck    | clean, zero warnings            | `pnpm lint`, `pnpm typecheck`, 2026-11-15  |
| `web-ext lint`      | 0 errors, 0 warnings, 0 notices | `pnpm lint:firefox`, 2026-11-15            |
| Content script size | 18.93 kB (CSS 896 B)            | `pnpm build` output, 2026-11-21            |
| CI                  | Green on first push             | GitHub Actions run 43806484751, 2026-11-15 |

## Known issues

- deepmerge (GHSA-gcqx-w48m-w2h4, low) has no fixed release. It is dev-time only and reviewed; see
  `docs/build-and-tooling.md` §4.
- Private-repository access through the same-origin tree JSON is still unverified (T-GNR-201).
  Signed-in markup is verified identical (T-GNR-012).
- The server renders at most 100 listing rows; React is expected to add the rest after hydration.
  Not yet observed live (T-GNR-106).

## Next steps

1. Phase 2 Sprint 1: the data layer, starting with spike T-GNR-201 (same-origin tree JSON for
   private repositories in Firefox).
2. Open follow-ups from bot reviews: issues #13 and #15 (non-blocking). The collapse lifecycle
   edge cases are closed: #17 by #20, #21 by #22, and #23 by its own PR.
