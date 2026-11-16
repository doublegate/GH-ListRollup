# Research update 2026-11-16: signed-in vs signed-out DOM

**Supplements:** `github-code-view-dom.md` §7 (2026-11-15), research report §8 open question 1
**Ticket:** T-GNR-012
**Evidence:**

- `tests/fixtures/html/{root,folder}.html`, captured signed out.
- `tests/fixtures/html/{root,folder}-logged-in.html`, captured signed in with the account
  replaced by `fixture-user`.
- The selector counts below come from `pnpm fixtures:report` (`scripts/fixture-dom-report.ts`).

## Question

Does GitHub serve different code-view markup to signed-in users? The original research observed
only signed-out pages.

## Answer: no difference for any selector the extension uses

On both layouts (repository root `git/git`, and folder `git/git/tree/master/contrib`), every selector
in `docs/dom-integration.md` §2 matched the same number of elements signed in and signed out.
Captured server HTML, 2026-11-16:

| Selector | root | root, signed in | folder | folder, signed in |
|---|---|---|---|---|
| `react-app[app-name="code-view"]` | 1 | 1 | 1 | 1 |
| `[data-testid="directory-content"]` | 1 | 1 | 1 | 1 |
| `tr.react-directory-row` | 100 | 100 | 18 | 18 |
| `a[data-testid="up-tree"]` | 0 | 0 | 1 | 1 |
| `a[aria-label$=", (Directory)"]` | 62 | 62 | 28 | 28 |
| name cells, small and large | 100 / 100 | 100 / 100 | 18 / 18 | 18 / 18 |
| `[data-testid="latest-commit-details"]` | 1 | 1 | 1 | 1 |
| `tr[data-testid="view-all-files-row"]` | 1 | 1 | 1 | 1 |

The signed-in pages differ only outside the listing: the header (account menu, notifications) and
the `currentUser` and `viewer` fields in the embedded JSON.

## New observations

1. **Row-link `aria-label` suffixes** seen: `(Directory)`, `(File)`, `(Submodule)` and
   `(Symlink to file)`. Only `(Directory)` gets an expansion arrow (`docs/dom-integration.md` §2.2).
   A directory symlink's suffix has not been observed in the DOM yet; the JSON type exists
   (`research-update-2026-11-16-content-types.md`).
2. **The server renders at most 100 rows.** The `git/git` root has 564 entries. The server HTML
   contains 100 `react-directory-row` rows, while the embedded JSON carries all 564 items.
   - Inference, not yet observed live: React renders the remaining rows after hydration, so the
     row count changes after first paint on large folders.
   - Phase 1's scoped observer and idempotent `apply()` (`docs/dom-integration.md` §4) must handle
     this. T-GNR-106 adds a test for it.
3. **"View all files" is mobile-only truncation.** On the root page the footer row has class
   `show-for-mobile`, and 90 rows carry `truncate-for-mobile`. On the folder page it is `d-none`.
   It is not the 100-row server limit.
4. **Branch-picker ids.** `#ref-picker-repos-header-ref-selector` is present on folder pages too,
   alongside `#ref-picker-repos-header-ref-selector-wide`, which appears only there. The ids are not
   mutually exclusive, so they must not be used to tell layouts apart. Use the `up-tree` row or the
   URL instead.
5. **Personal data in signed-in pages.** Beyond the login, the server HTML carries:
   - the user's numeric id, node id and primary email (`currentUser.userEmail`) in the embedded JSON
   - a signed notification channel, `data-channel="<base64>--<hmac>"`, whose payload encodes the user id
   - CSRF tokens
   - JWT-signed image URLs

   The fixture sanitizer now replaces or redacts all of these, and `--from-file` captures fail if
   the identity survives in plain text or inside base64 (`tests/fixtures/README.md`).
