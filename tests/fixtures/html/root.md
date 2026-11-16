# Fixture: html/root

- **Source:** <https://github.com/git/git>
- **Captured:** 2026-11-16 (logged out, by `scripts/capture-fixture.ts`)
- **HTTP status:** 200
- **Content:** ref `master` at commit `7fb6055e678f800320d8ab8cd8f201d9493d1ba0`
- **SHA-256 of `root.html`:** `f7d701e7cf75516d086e468a31e6b42391d9ff5f32fa7a4b5affdf09326c1ebe`

Repository root (overview layout): directories, files, a submodule (sha1collisiondetection) and a file symlink (RelNotes).

Sanitized: scripts other than the code-view payload, links, styles, non-allowlisted meta tags,
nonces, analytics/hydro attributes, HMACs, CSRF and other tokens, and avatars are removed or
redacted. Re-capture deliberately; see `tests/fixtures/README.md`.
