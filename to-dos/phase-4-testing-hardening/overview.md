# Phase 4: Testing and Hardening

**Status:** Planned. Refine the tickets when Phase 3 is about 75% complete.

## Goal

Automated end-to-end coverage in Chromium, a Firefox smoke suite, a weekly live probe of GitHub,
measured performance budgets, and a completed security review.

## Exit criteria

- [ ] Chromium E2E journeys from `docs/testing-strategy.md` §4 run in CI on every PR.
- [ ] The Firefox smoke suite runs nightly and is green.
- [ ] The weekly live-probe workflow opens an issue when a primary selector fails, verified with a
      deliberately broken selector on a branch.
- [ ] Performance budgets from `docs/architecture.md` §5 asserted in CI.
- [ ] Security checklist in `docs/security-privacy.md` §4 complete.

## Sprints

- [Sprint 1: E2E suites](sprint-1-e2e.md)
- [Sprint 2: Performance and security](sprint-2-perf-security.md)

## Reference docs

- `docs/testing-strategy.md`
- `docs/security-privacy.md`
- `docs/architecture.md` §5
