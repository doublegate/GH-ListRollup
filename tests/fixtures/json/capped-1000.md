# Fixture: json/capped-1000

- **Source:** <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types>
- **Captured:** 2026-11-16 (logged out, by `scripts/capture-fixture.ts`)
- **HTTP status:** 200
- **Content:** ref `master` at commit `302dab5cd36dba67332a8fde616727f7936de115`
- **SHA-256 of `capped-1000.json`:** `7ea15c77121032dddedf307c838021fae18065114fd326c1511b4064bd851bb1`

Folder over the 1,000-item cap: items.length is 1000 while totalCount is about 8,600.

Sanitized: scripts other than the code-view payload, links, styles, non-allowlisted meta tags,
nonces, analytics/hydro attributes, HMACs, CSRF and other tokens, and avatars are removed or
redacted. Re-capture deliberately; see `tests/fixtures/README.md`.
