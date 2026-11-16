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

- [ ] Fixture tests: the default is collapsed, a click expands, a second click collapses, and
      `aria-expanded` follows.
- [ ] The toggle exists before the hiding class is applied, asserted with a MutationObserver record
      order in the test.
- [ ] Clicks on the branch picker and on "Go to file" are unaffected.

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

- [ ] Fake-timer test: the pending attribute is removed by the watchdog when no listing appears.
- [ ] Test: when the header line is missing (confidence gate fails), `apply()` removes the pending
      attribute immediately, before the watchdog, and the rows are visible.
- [ ] Test: `apply()` on a non-listing page, including after a soft navigation, removes the pending
      attribute immediately; a non-listing URL never sets it.
- [ ] Test: replacing `tbody` restores the toggle within one frame.
- [ ] Test: `apply()` called 10 times produces one toggle.
- [ ] Firefox Navigation API finding recorded.

**Dependencies:** T-GNR-105 | **Reference:** `docs/dom-integration.md` §4 | **Complexity:** M

---

### T-GNR-107: Content stylesheet

**Description:** `src/entrypoints/content/style.css`, imported by the content script so WXT adds it
to the manifest `css`. It hides rows under the pending attribute or the collapsed class, styles the
chevron rotation (with `prefers-reduced-motion`), and uses only Primer variables.

**Acceptance criteria:**

- [ ] Every selector is scoped to `[data-gnr]`, `.gnr-*` or `html[data-gnr-pending]` (checked by a
      test that parses the CSS).
- [ ] Visually checked in light, dark and high-contrast themes.

**Dependencies:** T-GNR-105 | **Reference:** `docs/ui-behavior.md` §4, `docs/dom-integration.md` §5 | **Complexity:** S

---

### T-GNR-108: Soft-navigation state reset

**Description:** When an `apply()` follows a navigation to a different listing (`location.pathname`
changed, which covers a new repo, ref or folder path), reset the collapse state to the default.
Within the same listing, a re-render keeps the current state (`docs/architecture.md` §3.2).

**Acceptance criteria:**

- [ ] Test: expand, simulate a re-render, and the listing is still expanded.
- [ ] Test: expand, navigate to another repo, and the new page is collapsed.
- [ ] Test: expand on the repository root, soft-navigate to a folder in the same repo and ref, and the
      folder page is collapsed.

**Dependencies:** T-GNR-106 | **Reference:** `docs/architecture.md` §3.2 | **Complexity:** S

---

### T-GNR-109: Manual live verification and CHANGELOG

**Description:** Run the Phase 1 exit checks on live GitHub in Chrome and Firefox, and record the
results in the sprint notes.

**Acceptance criteria:**

- [ ] All Phase 1 exit criteria checked.
- [ ] `CHANGELOG.md` `[Unreleased]` has a line under "Added" for the listing collapse.

**Dependencies:** T-GNR-105 to T-GNR-108 | **Reference:** `docs/testing-strategy.md` §5 | **Complexity:** S

---

## Sprint review checklist

- [ ] Demo: cold load, toggle, soft navigation, extension reload.
- [ ] `docs/ui-behavior.md` updated for any behaviour that changed during implementation.
