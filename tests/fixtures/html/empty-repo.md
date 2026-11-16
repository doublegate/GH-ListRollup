# Fixture: html/empty-repo

- **Source:** <https://github.com/bihealth/dafthelper>
- **Captured:** 2026-11-16 (logged out, by `scripts/capture-fixture.ts`)
- **HTTP status:** 200
- **Content:** ref not found in embedded data
- **SHA-256 of `empty-repo.html`:** `432c559f7fd58e53b099cf38fcfbd29804c30f1ac516a79f112a3aab15b20fd0`

An empty public repository: no code-view app and no listing, but the fallback page gate matches (T-GNR-103).

Sanitized: scripts other than the code-view payload, links, styles, non-allowlisted meta tags,
nonces, analytics/hydro attributes, HMACs, CSRF and other tokens, and avatars are removed or
redacted. Re-capture deliberately; see `tests/fixtures/README.md`.
