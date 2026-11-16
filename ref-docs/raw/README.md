# ref-docs/raw: local research captures (not published)

Everything in this folder except this README is **gitignored**. It holds raw material saved during the
2026-11-15 research, so the evidence survives reboots on the development machine. It is not
published, for two reasons:

- It contains third-party content: GitHub's page HTML and response headers, and GitHub's own minified
  JavaScript bundles.
- The pages are not sanitized.

If a clone of this repository has no files here, that is expected.

| Path | What it is | Cited in |
|---|---|---|
| `2026-11-15/github-samples/root.html`, `tree.html`, `*.hdr` | Logged-out curl captures of `microsoft/vscode` (root and `/tree/main/src/vs`), with response headers | `../github-code-view-dom.md` [S1][S2] |
| `2026-11-15/github-samples/*.json` | Tree JSON responses (`Accept: application/json`) for vscode, rust-lang/rust, git/git, DefinitelyTyped (the 1,000-item cap) and refined-github/sandbox (slash branch); `tree-commit-info`, `latest-commit` and `tree-list` responses; REST contents and git-trees responses | `../github-data-sources.md` [S2][S3][S5] |
| `2026-11-15/github-samples/js/` | GitHub's JS bundles, read to find the `soft-nav:*` constants and GitHub's fetch-wrapper headers | `../github-navigation-events.md` [S1], `../github-data-sources.md` [S4] |
| `2026-11-15/github-samples/rgh/`, `gud.js` | Refined GitHub source and the github-url-detection build, both MIT | `../prior-art.md`, `../github-navigation-events.md` [S3] |
| `2026-11-15/mdn-bcd/` | MDN browser-compat-data JSON (CC0) for the manifest keys and APIs used, plus the script that walked it | `../chrome-mv3.md` [S12], `../firefox-mv3.md` [S10] |

**Using these for test fixtures.** Do not copy files from here into `tests/fixtures/` directly.
Fixture capture (T-GNR-011) re-fetches pages and sanitizes them by stripping scripts, nonces,
analytics metadata and avatars. These files are only reference material for that work.
