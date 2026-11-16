# Research update 2026-11-16: tree JSON content types

**Supplements:** `github-data-sources.md` (2026-11-15), research report §3
**Found during:** T-GNR-013, recording JSON fixtures

## Finding

GitHub's tree JSON has at least five values of `contentType`. The original research listed four:
`directory`, `file`, `submodule` and `symlink_file`. The fifth is `symlink_directory`, used for a
symlink that points at a directory.

| `contentType` | Observed in | Fixture |
|---|---|---|
| `directory`, `file` | everywhere | `tests/fixtures/json/root.json`, `nested.json` |
| `submodule` (with `submoduleUrl`) | `git/git` root, `rust-lang/rust` `src/tools` | `root.json`, `submodule.json` |
| `symlink_file` | `git/git` root (`RelNotes`) | `root.json` |
| `symlink_directory` | `torvalds/linux` `scripts/dtc/include-prefixes` (12 entries) | `symlink-directory.json` |

Observed directly on 2026-11-16, logged out, with `Accept: application/json`.

## Consequences

- `docs/data-fetching.md` §2 maps `symlink_directory` to `kind: 'symlink'`. As specified in
  `docs/ui-behavior.md` §3.3, symlinks get no expansion arrow in v1.
- The parser must still map unknown values to `unknown` rather than fail. The set has already turned
  out to be open-ended once.
- The DOM `aria-label` suffix for a directory symlink was not observed. `docs/dom-integration.md`
  §2.2 should check it when T-GNR-205 adds arrows: only `(Directory)` gets an arrow, so a different
  suffix would correctly get none.

## Other observations from fixture capture

- **What changes between fetches.** Two fetches of the same page a few seconds apart differed only
  in four `<meta>` values: `request-id`, `html-safe-nonce`, `visitor-payload` and `visitor-hmac`.
  Asset hashes, `release` and similar values change with GitHub deploys. The sanitizer keeps an
  allowlist of `<meta>` names rather than removing a denylist.
- **Tokens in the payload.** The code-view embedded JSON includes an anonymous `uploadToken` and a
  `csrf_tokens` map even when logged out. They were identical across the two fetches. Fixtures
  redact them.
- **404 bodies.** A tree JSON request for a missing path returns HTTP 404 with a full
  `codeViewTreeRoute` payload: `meta.title` is "File not found", alongside repository data and the
  file tree. That came to 80 KB for `git/git`.
