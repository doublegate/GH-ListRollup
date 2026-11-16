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

- [ ] Every row of the §2 table is implemented.
- [ ] Unit tests pass on the `root`, `folder`, and logged-in fixtures.
- [ ] A test fails if `querySelector(` appears in `src/` outside `selectors.ts`.

**Dependencies:** T-GNR-014 | **Reference:** `docs/dom-integration.md` §1-§2 | **Complexity:** M

---

### T-GNR-102: `probe()` diagnostics

**Description:** `probe(document)` returns, for each purpose, the rank that matched (`primary`,
`fallbackN` or `none`). Logged once per page when `debug.logging` is on.

**Acceptance criteria:**

- [ ] All `primary` on fresh fixtures.
- [ ] `root-stripped.html` reports fallbacks.
- [ ] Output is serializable, for reuse by the live probe in T-GNR-403.

**Dependencies:** T-GNR-101 | **Reference:** `docs/dom-integration.md` §6 | **Complexity:** S

---

### T-GNR-103: DOM-backed page model

**Description:** Extend `detectPage` into `readListingPage(url, document)` returning the
`ListingPage` defined in `docs/dom-integration.md` §3: owner, repo, ref (derived from the row hrefs
minus the known path), path (from the breadcrumb, or empty for the root) and layout.

**Acceptance criteria:**

- [ ] Correct ref for `main`, a tag, and the slash ref `branch/with/slashes`.
- [ ] Correct ref for a commit SHA URL.
- [ ] Returns `null` when the code-view gate fails.
- [ ] Empty-repo fixture: returns a page with `ref` unresolved, without throwing.

**Dependencies:** T-GNR-101 | **Reference:** `docs/dom-integration.md` §3 | **Complexity:** M

---

### T-GNR-104: Header-line locator

**Description:** Find the latest-commit bar's inner row on both layouts: inside the listing box on
the root page, and a separate box on folder pages. Return the insertion point for the toggle.

**Acceptance criteria:**

- [ ] Returns the insertion point on root and folder fixtures, logged in and out.
- [ ] Returns `null` (and `probe` reports `none`) on a fixture with the commit bar removed.

**Dependencies:** T-GNR-101 | **Reference:** `docs/dom-integration.md` §2.1 | **Complexity:** S

---

## Sprint review checklist

- [ ] `docs/dom-integration.md` §2 matches the implemented selectors exactly.
- [ ] Coverage of `src/github/` is at least 80% lines.
