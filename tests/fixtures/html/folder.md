# Fixture: html/folder

- **Source:** <https://github.com/git/git/tree/master/contrib>
- **Captured:** 2026-11-16 (logged out, by `scripts/capture-fixture.ts`)
- **HTTP status:** 200
- **Content:** ref `master` at commit `7fb6055e678f800320d8ab8cd8f201d9493d1ba0`
- **SHA-256 of `folder.html`:** `17aeba7560dd32e918147e86fef37caf3f8648d3986f92ad0283c8207e4a6ca2`

Folder page layout: sticky breadcrumb header, separate latest-commit box, parent-directory (up-tree) row.

Sanitized: scripts other than the code-view payload, links, styles, non-allowlisted meta tags,
nonces, analytics/hydro attributes, HMACs, CSRF and other tokens, and avatars are removed or
redacted. Re-capture deliberately; see `tests/fixtures/README.md`.
