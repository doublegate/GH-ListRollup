# tests/fixtures

Recorded GitHub pages and tree JSON responses. Treat them as golden vectors: change them only on
purpose, in a commit that names the GitHub change they track (`docs/testing-strategy.md` §3).

- **Sources:** `manifest.json`.
- **Provenance:** each `<name>.md` beside a fixture records the source URL, capture date, HTTP
  status, ref, commit and SHA-256.

## HTML (`html/`)

| Fixture                 | Source                                            | Covers                                                                                                |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `root.html`             | `git/git`                                         | Repository root (overview layout): listing inside the commit-bar box, submodule and file-symlink rows |
| `folder.html`           | `git/git/tree/master/contrib`                     | Folder layout: sticky breadcrumb, separate latest-commit box, parent-directory (`up-tree`) row        |
| `root-logged-in.html`   | `git/git`, signed in                              | The same page rendered for a signed-in user; identity replaced by `fixture-user`                      |
| `folder-logged-in.html` | `git/git/tree/master/contrib`, signed in          | The same page rendered for a signed-in user; identity replaced by `fixture-user`                      |
| `folder-deep.html`      | `git/git/tree/master/contrib/completion`          | Two-level folder: a breadcrumb with an intermediate segment (T-GNR-103)                               |
| `root-tag.html`         | `git/git/tree/v2.47.0`                            | Root listing at a tag ref                                                                             |
| `root-sha.html`         | `git/git` at a full commit SHA                    | Root listing at a commit SHA                                                                          |
| `root-slash-ref.html`   | `refined-github/sandbox/tree/branch/with/slashes` | Root on a ref containing `/`, with a single file row (`/blob/` link)                                  |
| `empty-repo.html`       | `bihealth/dafthelper`                             | An empty repository: no code-view app or listing, but the fallback page gate matches                  |

## JSON (`json/`)

| Fixture                  | Source                                          | Covers                                           |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------ |
| `root.json`              | `git/git` root                                  | `directory`, `file`, `submodule`, `symlink_file` |
| `nested.json`            | `microsoft/vscode` `src/vs`                     | A nested folder                                  |
| `capped-1000.json`       | `DefinitelyTyped` `types`                       | 1,000 items, with `totalCount` of about 8,600    |
| `simplified-chain.json`  | `microsoft/vscode` root                         | `hasSimplifiedPath` (`.agents/skills/launch`)    |
| `submodule.json`         | `rust-lang/rust` `src/tools`                    | Several submodules with `submoduleUrl`           |
| `symlink-directory.json` | `torvalds/linux` `scripts/dtc/include-prefixes` | `symlink_directory`                              |
| `slash-ref.json`         | `refined-github/sandbox` `branch/with/slashes`  | A ref name containing `/`                        |
| `not-found-404.json`     | a missing `git/git` path                        | HTTP 404 with a "File not found" JSON body       |

## Commands

```sh
pnpm fixtures:capture                 # re-capture everything (unchanged files are left untouched)
pnpm fixtures:capture root nested     # selected fixtures
pnpm fixtures:check                   # compare with live GitHub; exit 1 on drift; writes nothing
pnpm fixtures:report                  # selector match counts per HTML fixture; flags signed-in/out differences
```

### Signed-in fixtures

The capture script never sends credentials, so it skips the `loggedIn: true` entries. To refresh
them:

1. In a browser signed in to GitHub, save the page's server HTML to a file. Save Page As with
   "Webpage, HTML Only" works. So does a same-origin `fetch()` of the page followed by a download.
2. Sanitize it, passing every identifier of the signed-in account:

   ```sh
   node scripts/capture-fixture.ts --from-file <saved.html> --name root-logged-in \
     --login <login> --user-id <id> --node-id <node_id> --email <primary email>
   ```

   `gh api user --jq '{login,id,node_id}'` gives the first three.
   All four are required and must be non-empty: an identifier left out would be neither
   replaced nor checked for.

3. The command fails if any identifier survives, either in plain text or inside base64-encoded
   data. Even when it passes, review the result by hand before committing:
   - Check the embedded `currentUser` and `viewer` JSON.
   - Grep for the login, the email and the names of your own repositories.
4. Delete the saved raw file. It contains live session tokens.

When the sanitizer changes, refresh the signed-in fixtures from their committed copies with
`pnpm fixtures:capture --reprocess`. No browser is needed.

Sanitizing is done by `scripts/lib/sanitize.ts`, with tests in `tests/unit/sanitize.test.ts`:

- Scripts are removed, except the inert code-view JSON.
- `<link>` and `<style>` elements are removed.
- Only allowlisted `<meta>` tags are kept.
- Nonces, integrity hashes, analytics and hydro attributes, HMACs and CSRF tokens are removed.
- Tokens inside JSON are redacted.
- Avatar URLs are blanked.
- Email fields are replaced.
- Signed values are redacted wherever they appear: Rails-style `<base64>--<hmac>` messages and
  `jwt=` URL parameters.
- Volatile values are normalized: random UUID element ids, server timings and star, fork and
  watcher counts.
- For signed-in captures, the account's login, id, node id and email are replaced throughout.
- **Minimization.** Fixtures keep only what tests use: the page structure, the code-view app, the
  listing and the embedded tree data. Removed:
  - GitHub's site header and footer, and the signed-in command palette
  - rendered markdown (README articles, and `richText` in JSON), which is third-party prose
  - Octicon path drawings (the `<svg>` elements and classes stay)

  This keeps committed fixtures to factual structure, such as element names, test ids and file
  names, in line with the rule that fixtures be freely licensable. Sanitizing is idempotent, so
  `pnpm fixtures:capture --reprocess` re-applies the current rules to the committed signed-in
  fixtures without a new browser capture.

`tests/unit/fixtures.test.ts` checks every committed fixture for leftover tokens, nonces and
avatar URLs.

## Using them in tests

```ts
import { useHtmlFixture, loadJsonFixture } from '../helpers/fixture';

describe('folder page', () => {
  useHtmlFixture('folder'); // document = folder.html, location = its source URL
  it('...', () => {
    /* query document */
  });
});

const tree = loadJsonFixture('capped-1000');
```

Do not edit fixture files by hand. Re-capture them, or extend the sanitizer and re-capture.
