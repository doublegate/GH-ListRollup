# Roadmap

Entry point for planning. Each phase links to its overview; each sprint file holds tickets with
acceptance criteria. Ticket IDs take the form `T-GNR-<phase><NN>`, for example `T-GNR-104` (Phase 1,
ticket 04). They are stable: cite them in branches, commits and PRs.

## Status

- **Current phase:** Phase 0, Foundation.
- **Current sprint:** Sprint 2, Fixtures and capture tooling. Sprint 1 (Skeleton and CI) completed
  2026-11-16.
- **Last updated:** 2026-11-15.

## Phases

| Phase                                                                | Goal                                                        | Exit criterion                                                                                                        | Estimate  |
| -------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- |
| [0 Foundation](phase-0-foundation/overview.md)                       | Skeleton builds and loads in both browsers; CI green        | `pnpm check` green locally and in CI; skeleton logs page type in Chrome and Firefox                                   | 1 week    |
| [1 Listing collapse](phase-1-listing-collapse/overview.md)           | Level 1 on every listing page, surviving soft navigation    | E2E on fixtures plus a manual live check: collapsed by default, toggle works, no duplicates after 20 soft navigations | 2 weeks   |
| [2 Inline tree](phase-2-inline-tree/overview.md)                     | Level 2 lazy inline expansion with cache, keyboard and ARIA | Expanding three levels deep on a public and a private repo in both browsers; re-expand makes 0 requests               | 2-3 weeks |
| [3 Settings and resilience](phase-3-settings-resilience/overview.md) | Options page, selector fallbacks, optional REST fallback    | Stripped-hook fixtures still work through fallbacks; settings apply live                                              | 2 weeks   |
| [4 Testing and hardening](phase-4-testing-hardening/overview.md)     | E2E suites, performance budgets, security review            | All gates in `docs/testing-strategy.md` §7 plus a weekly live probe                                                   | 1-2 weeks |
| [5 Release](phase-5-release/overview.md)                             | Store listings and v1.0.0                                   | Both stores published; release gate in `docs/release.md` §4 passed                                                    | 1-2 weeks |

### Sprints

- **Phase 0**
  - [Sprint 1: Skeleton and CI](phase-0-foundation/sprint-1-skeleton-ci.md)
  - [Sprint 2: Fixtures and capture tooling](phase-0-foundation/sprint-2-fixtures.md)
- **Phase 1**
  - [Sprint 1: Selectors and page model](phase-1-listing-collapse/sprint-1-selectors-page-model.md)
  - [Sprint 2: Collapse controller and lifecycle](phase-1-listing-collapse/sprint-2-collapse-controller.md)
- **Phase 2**
  - [Sprint 1: Data layer](phase-2-inline-tree/sprint-1-data-layer.md)
  - [Sprint 2: Tree controller and UI](phase-2-inline-tree/sprint-2-tree-ui.md)
- **Phase 3**
  - [Sprint 1: Settings and options page](phase-3-settings-resilience/sprint-1-settings.md)
  - [Sprint 2: Resilience and fallback](phase-3-settings-resilience/sprint-2-resilience.md)
- **Phase 4**
  - [Sprint 1: E2E suites](phase-4-testing-hardening/sprint-1-e2e.md)
  - [Sprint 2: Performance and security](phase-4-testing-hardening/sprint-2-perf-security.md)
- **Phase 5**
  - [Sprint 1: Store release](phase-5-release/sprint-1-store-release.md)

## Cross-phase dependencies

- Phase 2 Sprint 1 starts with the spike T-GNR-201. Its result (does the same-origin JSON work
  logged in, on private repos, in Firefox?) decides whether T-GNR-302 (the REST fallback) is
  required or optional.
- Phase 1 and Phase 2 both need the fixtures from Phase 0 Sprint 2.
- Phase 4 Sprint 1's live probe reuses `probe()` from T-GNR-102.

## Open questions blocking planning

From `ref-docs/research-report.md` §8:

1. Logged-in DOM differences (answered by T-GNR-012).
2. Private repos and Firefox cookie behaviour on the tree JSON (T-GNR-201).
3. Whether the `navigate` event reaches Firefox content scripts (T-GNR-106).
4. Whether the REST fallback ships in v1 (decided at the end of Phase 2; ADR needed).
