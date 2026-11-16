# Fixture: json/not-found-404

- **Source:** <https://github.com/git/git/tree/master/this-path-does-not-exist-gnr>
- **Captured:** 2026-11-16 (logged out, by `scripts/capture-fixture.ts`)
- **HTTP status:** 404
- **Content:** ref `master` at commit `7fb6055e678f800320d8ab8cd8f201d9493d1ba0`
- **SHA-256 of `not-found-404.json`:** `6836e612952427aca4ae90ae7cad888399a2d50bad8b0c12f5c43176fd763274`

Missing path: GitHub answers 404 with a JSON body.

Sanitized: scripts other than the code-view payload, links, styles, non-allowlisted meta tags,
nonces, analytics/hydro attributes, HMACs, CSRF and other tokens, and avatars are removed or
redacted. Re-capture deliberately; see `tests/fixtures/README.md`.
