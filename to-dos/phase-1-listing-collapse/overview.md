# Phase 1: Listing Detection and Whole-Listing Collapse

## Goal

On every repository listing page (the root, `/tree/<ref>` and folder pages), the file listing starts
collapsed to its header line, the latest-commit bar. An arrow there expands and collapses it. The
behaviour survives soft navigation, React re-renders and extension reloads, and when GitHub's markup
cannot be identified the extension does nothing (`docs/ui-behavior.md` §2).

## Exit criteria

- [x] Fixture tests: toggle present exactly once on root and folder fixtures, rows hidden, and
      `aria-expanded` correct.
- [x] Stripped-hook fixture: either the fallbacks work, or the page is left untouched with rows
      visible. Never hidden without a toggle.
- [x] Manual live check in both browsers: 20 consecutive soft navigations leave exactly one toggle
      per listing page.
- [x] No flash of the full listing on a cold load (visual check), and the 4-second watchdog is
      verified by a test.

## Scope

- **In scope:** the selectors module and `probe()`, the DOM-backed page model, the collapse
  controller, styles, the lifecycle (pending attribute, watchdog, observers).
- **Out of scope:** per-repo memory, which is Phase 3 settings. Folder arrows are Phase 2.

## Sprints

- [Sprint 1: Selectors and page model](sprint-1-selectors-page-model.md)
- [Sprint 2: Collapse controller and lifecycle](sprint-2-collapse-controller.md)

## Dependencies

Phase 0 complete, including the fixtures.

## Risks

- **Hydration mismatch from early DOM changes.** Detect: React console warnings, or the toggle
  disappearing. Response: insert after hydration, rely on idempotent re-apply.
- **Header line differs logged in.** Detect: T-GNR-012 fixtures. Response: adjust the selectors.
- **Refined GitHub conflicts.** Detect: the manual check with it installed. Response: scope CSS.

## Reference docs

- `docs/dom-integration.md`
- `docs/ui-behavior.md` §2
- `docs/architecture.md` §3.1-§3.2
