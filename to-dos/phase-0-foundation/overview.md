# Phase 0: Foundation

## Goal

A WXT + TypeScript project that builds MV3 packages for Chrome and Firefox. The packages load
unpacked, and the content script logs the detected page type on load and after soft navigation.
Lint, format, type-check, unit tests and `web-ext lint` are green, and the same gates run in CI. Saved
GitHub fixtures exist for later phases.

## Exit criteria

- [x] `pnpm check` passes locally (2026-11-15).
- [x] CI workflow green on GitHub (2026-11-15).
- [ ] Skeleton verified manually in Chrome and Firefox (log lines on root, folder and after soft
      navigation).
- [ ] Fixtures for both layouts committed (Sprint 2).

## Scope

- **In scope:** tooling, manifests, CI, the page-type detector, navigation wiring, fixtures.
- **Out of scope:** any visible UI change to GitHub.

## Sprints

- [Sprint 1: Skeleton and CI](sprint-1-skeleton-ci.md)
- [Sprint 2: Fixtures and capture tooling](sprint-2-fixtures.md)

## Risks

- **WXT minor-version breakage.** Detect: build fails after an upgrade. Response: versions are pinned,
  and upgrades are tickets.
- **AMO manifest rules change.** Detect: `web-ext lint` in CI. Response: fix the manifest and record
  it in `docs/cross-browser.md`.

## Reference docs

- `docs/build-and-tooling.md`
- `docs/cross-browser.md`
- `docs/adr/0001-wxt-typescript.md`
