# Phase 1, Sprint 2: Collapse Controller and Lifecycle

**Phase:** 1, Listing collapse
**Sprint goal:** a collapsible listing that behaves per `docs/ui-behavior.md` §2 and survives
navigation.
**Estimated duration:** 1 week

## Tickets

### T-GNR-105: Toggle button and collapse controller

**Description:** `src/ui/toggle.ts` builds the chevron button (Octicon SVG through `createElementNS`,
`aria-expanded`, `aria-controls`, accessible name). `src/features/collapse.ts` inserts it at the
header line and then sets the collapsed class on the listing container, in that order, and handles
click, Enter and Space.

**Acceptance criteria:**

- [x] Fixture tests: the default is collapsed, a click expands, a second click collapses, and
      `aria-expanded` follows.
- [x] The toggle exists before the hiding class is applied, asserted with a MutationObserver record
      order in the test.
- [x] Clicks on the branch picker and on "Go to file" are unaffected.

**Dependencies:** T-GNR-104 | **Reference:** `docs/ui-behavior.md` §2.2-§2.3 | **Complexity:** M

---

### T-GNR-106: Lifecycle (pending attribute, watchdog, observers)

**Description:** Implement `docs/dom-integration.md` §4:

- `html[data-gnr-pending]` at `document_start`
- a 4-second watchdog
- a first-listing observer
- the scoped re-render observer, limited to 50 runs per page
- `navigatesuccess`, with a `popstate` fallback

Find out whether the `navigate` / `navigatesuccess` events reach Firefox content scripts, and record
the answer in `docs/dom-integration.md`.

**Acceptance criteria:**

- [x] Fake-timer test: the pending attribute is removed by the watchdog when no listing appears.
- [x] Test: when the header line is missing (confidence gate fails), `apply()` removes the pending
      attribute immediately, before the watchdog, and the rows are visible.
- [x] Test: `apply()` on a non-listing page, including after a soft navigation, removes the pending
      attribute immediately; a non-listing URL never sets it.
- [x] Test: replacing `tbody` restores the toggle within one frame. The toggle lives in the commit
      bar, not `tbody`, so two tests cover it: replacing `tbody` keeps one toggle and the state, and
      React replacing the commit bar's inner row gets the toggle back on the next frame.
- [x] Test: `apply()` called 10 times produces one toggle.
- [ ] Firefox Navigation API finding recorded.
- [x] Test: after a soft navigation, `apply()` acts only once the listing in the DOM belongs to the
      new URL (`readListingPage` resolves a ref that passes the cross-check, or the layout and path
      match the URL). Observed live 2026-11-16: GitHub fires `soft-nav:*`/`turbo:*` **before** React
      renders the new listing, so the first read sees the previous page's DOM
      (`ref-docs/research-update-2026-11-16-phase1-fixtures.md` §6).

**Dependencies:** T-GNR-105 | **Reference:** `docs/dom-integration.md` §4 | **Complexity:** M

---

### T-GNR-107: Content stylesheet

**Description:** `src/entrypoints/content/style.css`, imported by the content script so WXT adds it
to the manifest `css`. It hides rows under the pending attribute or the collapsed class, styles the
chevron rotation (with `prefers-reduced-motion`), and uses only Primer variables.

**Acceptance criteria:**

- [x] Every selector is scoped to `[data-gnr]`, `.gnr-*` or `html[data-gnr-pending]` (checked by a
      test that parses the CSS).
- [ ] Visually checked in light, dark and high-contrast themes.

**Dependencies:** T-GNR-105 | **Reference:** `docs/ui-behavior.md` §4, `docs/dom-integration.md` §5 | **Complexity:** S

---

### T-GNR-108: Soft-navigation state reset

**Description:** When an `apply()` follows a navigation to a different listing (`location.pathname`
changed, which covers a new repo, ref or folder path), reset the collapse state to the default.
Within the same listing, a re-render keeps the current state (`docs/architecture.md` §3.2).

**Acceptance criteria:**

- [x] Test: expand, simulate a re-render, and the listing is still expanded.
- [x] Test: expand, navigate to another repo, and the new page is collapsed.
- [x] Test: expand on the repository root, soft-navigate to a folder in the same repo and ref, and the
      folder page is collapsed.

**Dependencies:** T-GNR-106 | **Reference:** `docs/architecture.md` §3.2 | **Complexity:** S

---

### T-GNR-109: Manual live verification and CHANGELOG

**Description:** Run the Phase 1 exit checks on live GitHub in Chrome and Firefox, and record the
results in the sprint notes.

**Acceptance criteria:**

- [ ] All Phase 1 exit criteria checked.
- [x] `CHANGELOG.md` `[Unreleased]` has a line under "Added" for the listing collapse.

**Dependencies:** T-GNR-105 to T-GNR-108 | **Reference:** `docs/testing-strategy.md` §5 | **Complexity:** S

---

## Sprint review checklist

- [ ] Demo: cold load, toggle, soft navigation, extension reload.
- [x] `docs/ui-behavior.md` updated for any behaviour that changed during implementation.

## Completion notes (2026-11-16)

- **Modules:**
  - `src/ui/toggle.ts`: the button. It uses the Octicon `chevron-right`, with its MIT notice in
    `NOTICE`.
  - `src/features/collapse.ts`: the `CollapseController`, with `apply()`, staleness detection, the
    state reset, the no-late-collapse rule and the re-render observer.
  - `src/features/lifecycle.ts`: the pre-hide, the watchdog, the first-listing observer and the
    triggers.
  - `src/entrypoints/content/style.css`.
  - `watchNavigation` also listens for the Navigation API's `navigatesuccess`. The content script
    logs which signals arrive, once per type at debug level, for the Firefox finding.
- **Tests:**
  - 26 controller and lifecycle tests plus the stylesheet tests (`tests/unit/collapse.test.ts`,
    `tests/unit/style.test.ts`).
  - Seven mutations (class before toggle, no staleness check, late collapse allowed, the no-header
    exit keeping pending, no reset on navigation, no re-render budget, a watchdog that does
    nothing) are each caught by the test for that rule.
- **Live, Chromium (`tests/e2e/manual/t-gnr-109.mjs`, `wxt-dev/wxt`, logged out):**
  - The cold load shows one collapsed toggle.
  - A click shows the listing, and a second click hides it.
  - 20 consecutive soft navigations (folder and Back) each leave exactly one collapsed toggle.
  - Light and dark screenshots were checked visually.
- **Still open, needs the maintainer:**
  - the Firefox live check;
  - the high-contrast theme;
  - the Firefox Navigation API finding.
