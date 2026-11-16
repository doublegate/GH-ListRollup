# Phase 1, Sprint 1: Selectors and Page Model

**Phase:** 1, Listing collapse
**Sprint goal:** a single, tested source of truth for finding GitHub's listing on both layouts.
**Estimated duration:** 1 week

## Tickets

### T-GNR-101: Selectors module

**Description:** `src/github/selectors.ts` holds a ranked selector list for each purpose in
`docs/dom-integration.md` §2 and a `query(purpose, root)` helper. No other file may contain selector
strings; add a lint rule or a test that greps for `querySelector` outside this module.

**Acceptance criteria:**

- [x] Every row of the §2 table is implemented.
- [x] Unit tests pass on the `root`, `folder`, and logged-in fixtures.
- [x] A test fails if `querySelector(` appears in `src/` outside `selectors.ts`. It also fails on a
      string passed to `.closest(` or `.matches(` (verified by a probe file).

**Dependencies:** T-GNR-014 | **Reference:** `docs/dom-integration.md` §1-§2 | **Complexity:** M

---

### T-GNR-102: `probe()` diagnostics

**Description:** `probe(document)` returns, for each purpose, the rank that matched (`primary`,
`fallbackN` or `none`). Logged once per page when `debug.logging` is on.

**Acceptance criteria:**

- [x] All `primary` on fresh fixtures.
- [x] A root page with its primary hooks stripped reports fallbacks. The stripped page is derived
      inside the test from `root.html` rather than saved as an edited fixture.
- [x] Output is serializable, for reuse by the live probe in T-GNR-403.

**Dependencies:** T-GNR-101 | **Reference:** `docs/dom-integration.md` §6 | **Complexity:** S

---

### T-GNR-103: DOM-backed page model

**Description:** Extend `detectPage` into `readListingPage(url, document)` returning the
`ListingPage` defined in `docs/dom-integration.md` §3: owner, repo, ref, path and layout. The path
comes from the breadcrumb selector, or is empty for the root. The ref comes from the first `(Directory)`
or `(File)` row whose link is under this repository's `/tree/` or `/blob/`, minus the known path and
name, and is cross-checked against `location.pathname`. It is `null` when any step fails.

**Acceptance criteria:**

- [x] Correct ref for `main`, a tag, and the slash ref `branch/with/slashes`.
- [x] Correct ref for a commit SHA URL.
- [x] Returns `null` when the code-view gate fails.
- [x] Empty-repo fixture: returns a page with `ref` unresolved, without throwing. The empty
      repository has no code-view app; the gate passes through its fallback
      (`ref-docs/research-update-2026-11-16-phase1-fixtures.md` §4).
- [x] A submodule row is never the reference row: a test with a submodule as the first row still
      resolves the ref from a later row.
- [x] Rows left from a different page (`location.pathname` does not match) give `ref: null`.

**Dependencies:** T-GNR-101 | **Reference:** `docs/dom-integration.md` §3 | **Complexity:** M

---

### T-GNR-104: Header-line locator

**Description:** Find the latest-commit bar's inner row on both layouts: inside the listing box on
the root page, and a separate box on folder pages. Return the insertion point for the toggle.

**Acceptance criteria:**

- [x] Returns the insertion point on root and folder fixtures, logged in and out.
- [x] Returns `null` (and `probe` reports `none`) on a fixture with the commit bar removed (removed
      inside the test).

**Dependencies:** T-GNR-101 | **Reference:** `docs/dom-integration.md` §2.1 | **Complexity:** S

---

## Sprint review checklist

- [x] `docs/dom-integration.md` §2 matches the implemented selectors exactly.
- [x] Coverage of `src/github/` is at least 80% lines (94.9% at completion, 2026-11-16).

## Completion notes (2026-11-16)

- Modules: `src/github/selectors.ts` (ranked selectors plus `query`, `queryAll`, `closest`,
  `matches`), `rows.ts` (row classification), `breadcrumb.ts`, `page.ts` (`readListingPage`),
  `header.ts` (`findHeaderLine`) and `probe.ts` (`probe`, `formatProbe`). `probe()` moved out of
  `selectors.ts` so that it can reuse the header-line lookup without an import cycle;
  `docs/dom-integration.md` §6 says so.
- Five logged-out fixtures were added for the ref and path cases. What they showed is recorded in
  `ref-docs/research-update-2026-11-16-phase1-fixtures.md`. Two spec rows changed as a result: the
  parent-row fallback (the original one also matched the root's "View all files" row) and the
  header line (box found through Primer's `.border`).
- `ListingPage.path` is `string | null`: `null` when a folder page's breadcrumb cannot be read.
- The content script logs the page model and the probe at `console.debug` level on listing pages.
  Nothing on the page changes yet.
