# Phase 0, Sprint 2: Fixtures and Capture Tooling

**Phase:** 0, Foundation
**Sprint goal:** committed, sanitized GitHub fixtures (HTML and JSON) that unit and E2E tests in
Phases 1-3 run against.
**Estimated duration:** 3-5 days

## Tickets

### T-GNR-011: Fixture capture script

**Description:** `scripts/capture-fixture.ts` fetches a public github.com URL logged out, with a
generic User-Agent and no credentials, strips scripts, analytics meta, nonces and avatars, and writes
`tests/fixtures/html/<name>.html`. With `--json` it saves a tree JSON response to
`tests/fixtures/json/`.

**Acceptance criteria:**

- [ ] Captures `root.html` (a public repo root) and `folder.html` (a nested folder).
- [ ] The output contains no `<script>` bodies except an allowlisted embedded-data block, and no
      `nonce=` attributes.
- [ ] Re-running on an unchanged page produces a byte-identical file.

**Dependencies:** T-GNR-001 | **Reference:** `docs/testing-strategy.md` §3 | **Complexity:** M

---

### T-GNR-012: Logged-in fixtures and DOM diff

**Description:** Capture root and folder pages from a dedicated test account. Sanitize them by hand.
Write a short supplement, `ref-docs/research-update-<date>-logged-in-dom.md`, listing differences
from the logged-out markup.

**Acceptance criteria:**

- [ ] `root-logged-in.html` and `folder-logged-in.html` committed, with no personal data (reviewed).
- [ ] The supplement exists and resolves open question 1 in the research report.
- [ ] `docs/dom-integration.md` §2 updated if any selector differs.

**Dependencies:** T-GNR-011 | **Reference:** `ref-docs/github-code-view-dom.md` §7 | **Complexity:** M

---

### T-GNR-013: JSON fixtures for the data layer

**Description:** Record tree JSON for the cases in `docs/testing-strategy.md` §2: root, nested, a
1,000-capped folder, a simplified chain, submodule, symlink, a slash ref and a 404.

**Acceptance criteria:**

- [ ] One file per case under `tests/fixtures/json/`, each with a header comment in an adjacent
      `.md` recording its source URL and capture date.
- [ ] Each file is under 200 KB (trim the capped folder's items if needed, keeping `totalCount`).

**Dependencies:** T-GNR-011 | **Reference:** `docs/data-fetching.md` §6 | **Complexity:** S

---

### T-GNR-014: Fixture loader helper for Vitest

**Description:** `tests/helpers/fixture.ts` loads an HTML fixture into happy-dom's `document` with a
given `location`, and resets it between tests.

**Acceptance criteria:**

- [ ] A test loads `root.html` and finds `[data-testid="directory-content"]`.
- [ ] A test loads `folder.html` and finds the `up-tree` row.

**Dependencies:** T-GNR-011 | **Reference:** `docs/testing-strategy.md` §1 | **Complexity:** S

---

## Sprint review checklist

- [ ] Fixtures reviewed for personal data before commit.
- [ ] Phase 0 exit criteria all checked.
