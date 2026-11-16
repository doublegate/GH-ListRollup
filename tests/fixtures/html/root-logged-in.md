# Fixture: html/root-logged-in

- **Source:** <https://github.com/git/git>
- **Captured:** 2026-11-16 (signed in; saved from a browser, then sanitized by `scripts/capture-fixture.ts --from-file` with the user identity replaced by `fixture-user`, and reviewed by hand)
- **HTTP status:** 200
- **Content:** ref `master` at commit `7fb6055e678f800320d8ab8cd8f201d9493d1ba0`
- **SHA-256 of `root-logged-in.html`:** `536526d097c9249daea28a2f41a3299606736ddcd704a599f49049fb5f79fbb5`

Same page as root.html, rendered for a signed-in user (T-GNR-012). Identity replaced with fixture-user.

Sanitized: scripts other than the code-view payload, links, styles, non-allowlisted meta tags,
nonces, analytics/hydro attributes, HMACs, CSRF and other tokens, and avatars are removed or
redacted. Re-capture deliberately; see `tests/fixtures/README.md`.
