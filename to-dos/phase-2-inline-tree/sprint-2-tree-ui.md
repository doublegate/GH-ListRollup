# Phase 2, Sprint 2: Tree Controller and UI

**Phase:** 2, Inline tree
**Sprint goal:** inline expansion behaving per `docs/ui-behavior.md` §3.
**Estimated duration:** 1-2 weeks

## Tickets

### T-GNR-205: Folder arrows on rows

**Description:** Add an arrow to every folder row in **both** name cells, and a spacer to file rows.
Skip the parent row, submodules and symlinks. Simplified chains target the deepest folder.

**Acceptance criteria:**

- [ ] Fixture test: the arrow count equals the folder count times 2, and the `..` row has none.
- [ ] A click on the folder name still navigates, with no `preventDefault` on the link.

**Dependencies:** T-GNR-101 | **Reference:** `docs/ui-behavior.md` §3.1, `docs/dom-integration.md` §2.2 | **Complexity:** M

---

### T-GNR-206: Inline rows and the tree controller

**Description:** `src/features/tree.ts` keeps a `Map<path, NodeState>`. On expand it shows a loading
row, calls the fetcher, and inserts `<tr data-gnr-row>` children with depth indentation. On collapse
it hides them. Rows are re-inserted after a React re-render. Folders over the cap get a "Show all N
items on GitHub" row.

**Acceptance criteria:**

- [ ] Three-level expansion on fixtures with recorded JSON.
- [ ] Re-expand makes 0 fetch calls.
- [ ] After `tbody` is replaced, expanded subtrees are restored within one frame.
- [ ] The 1,000-cap fixture shows the "Show all" row with the correct link.

**Dependencies:** T-GNR-204, T-GNR-205 | **Reference:** `docs/ui-behavior.md` §3.2 | **Complexity:** L

---

### T-GNR-207: Error rows

**Description:** Map the `docs/data-fetching.md` §5 errors to the rows in `docs/ui-behavior.md`
§3.3, including Retry.

**Acceptance criteria:**

- [ ] One test per error kind; Retry re-fetches and replaces the error row.

**Dependencies:** T-GNR-206 | **Reference:** `docs/ui-behavior.md` §3.3 | **Complexity:** S

---

### T-GNR-208: Keyboard and ARIA

**Description:** Implement `docs/ui-behavior.md` §3.4: Right and Left arrows, moving to the parent,
Up and Down between arrows, `role="group"`, and accessible names.

**Acceptance criteria:**

- [ ] Keyboard tests for each key.
- [ ] The axe-core check (via Playwright in Phase 4) reports no new violations on the listing. The
      ticket stays open until T-GNR-401.

**Dependencies:** T-GNR-206 | **Reference:** `docs/ui-behavior.md` §3.4 | **Complexity:** M

---

### T-GNR-209: Fallback decision

**Description:** Using the T-GNR-201 results and the Phase 2 experience, decide whether the REST
fallback ships in v1. Write ADR 0003, or amend ADR 0002 with a superseding note, and adjust the
Phase 3 plan.

**Acceptance criteria:**

- [ ] ADR committed.
- [ ] `docs/data-fetching.md` §4 and `docs/cross-browser.md` §2 consistent with the decision.

**Dependencies:** T-GNR-201 | **Reference:** `docs/adr/0002-same-origin-tree-json.md` | **Complexity:** S

---

## Sprint review checklist

- [ ] Phase 2 exit criteria checked in both browsers.
- [ ] `CHANGELOG.md` updated.
