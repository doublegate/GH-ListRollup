# Fixture: html/root

- **Source:** <https://github.com/git/git>
- **Captured:** 2026-11-16 (logged out, by `scripts/capture-fixture.ts`)
- **HTTP status:** 200
- **Content:** ref `master` at commit `7fb6055e678f800320d8ab8cd8f201d9493d1ba0`
- **SHA-256 of `root.html`:** `fd5e2b1a9e29556f024c0c903f95b89f80efaa0bd4b46fdc25c4713b4ccb6de4`

Repository root (overview layout): directories, files, a submodule (sha1collisiondetection) and a file symlink (RelNotes).

Sanitized: scripts other than the code-view payload, links, styles, non-allowlisted meta tags,
nonces, analytics/hydro attributes, HMACs, CSRF and other tokens, and avatars are removed or
redacted. Re-capture deliberately; see `tests/fixtures/README.md`.
