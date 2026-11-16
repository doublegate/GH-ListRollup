# Fixture: html/root

- **Source:** <https://github.com/git/git>
- **Captured:** 2026-11-16 (logged out, by `scripts/capture-fixture.ts`)
- **HTTP status:** 200
- **Content:** ref `master` at commit `7fb6055e678f800320d8ab8cd8f201d9493d1ba0`
- **SHA-256 of `root.html`:** `e36e3c6a3525673fc730642588e29985404186ce8bb2a9b0f9f7c3ea8b4d198c`

Repository root (overview layout): directories, files, a submodule (sha1collisiondetection) and a file symlink (RelNotes).

Sanitized: scripts other than the code-view payload, links, styles, non-allowlisted meta tags,
nonces, analytics/hydro attributes, HMACs, CSRF and other tokens, and avatars are removed or
redacted. Re-capture deliberately; see `tests/fixtures/README.md`.
