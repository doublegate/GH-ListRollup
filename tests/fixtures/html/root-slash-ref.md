# Fixture: html/root-slash-ref

- **Source:** <https://github.com/refined-github/sandbox/tree/branch/with/slashes>
- **Captured:** 2026-11-16 (logged out, by `scripts/capture-fixture.ts`)
- **HTTP status:** 200
- **Content:** ref `branch/with/slashes` at commit `f9dc77536144ede629d39e5f47f94b61ed34d9c8`
- **SHA-256 of `root-slash-ref.html`:** `a320c451dda0fc98a8598713a6c3bbccc14e4557155498d1f82658cc4dcdadbc`

Root listing on a ref containing slashes; the URL alone cannot locate the ref boundary (T-GNR-103).

Sanitized: scripts other than the code-view payload, links, styles, non-allowlisted meta tags,
nonces, analytics/hydro attributes, HMACs, CSRF and other tokens, and avatars are removed or
redacted. Re-capture deliberately; see `tests/fixtures/README.md`.
