# Testing Strategy

**Status:** Draft v0.1 (2026-11-15)
**Sources:** `ref-docs/testing-extensions.md`, `ref-docs/wxt-framework.md` (testing hooks),
`ref-docs/research-report.md` §5, §7

## 1. Layers

| Layer          | Tool                                                                           | Runs                                  | Scope                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Unit           | Vitest 5 + `WxtVitest()` + happy-dom                                           | every PR                              | Pure modules: page detector, selectors and `probe()`, tree-JSON parser, URL builder, fetcher queue and cache, settings validation |
| Fixture DOM    | Vitest + happy-dom + saved GitHub HTML                                         | every PR                              | `apply()` end-to-end on static markup: toggle inserted, rows hidden, arrows in both name cells, inline rows, idempotency          |
| E2E (Chromium) | Playwright 1.65, persistent context, `channel: 'chromium'`, headless           | every PR                              | Built extension on fixture pages served through `page.route('https://github.com/**')`                                             |
| Live probe     | Playwright, live github.com                                                    | weekly (scheduled) and before release | Selector drift against fixed public repos; one soft-navigation journey                                                            |
| Firefox smoke  | `web-ext lint` (every PR); WebdriverIO + BiDi `webExtension.install` (nightly) | as listed                             | Manifest validity; inject, collapse, survive a soft navigation                                                                    |
| Manual         | Checklist (§5)                                                                 | before release                        | Logged in, private repo, both browsers, alongside Refined GitHub                                                                  |

Playwright cannot load Firefox extensions, and branded Chrome removed the side-loading flags. That is
why Chromium E2E uses the bundled Chromium and Firefox has its own path (`ref-docs/testing-extensions.md`
Layer 2-3).

## 2. Unit test inventory (minimum)

| Module                   | Cases                                                                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github/page.ts`         | Root, `/tree/<ref>`, folder page, slash ref, blob, issues, reserved owners, invalid names, non-github host. **Done in Phase 0** (`tests/unit/page.test.ts`).                 |
| `github/selectors.ts`    | Every primary selector on every fixture. With a fixture whose primary hooks are stripped, `probe()` reports the fallback. With no match at all, the confidence gate refuses. |
| `data/tree-json.ts`      | Recorded responses: root, nested, 1,000-item cap with `totalCount`, simplified chain, submodule, symlink, unknown route key, malformed items, non-JSON body.                 |
| URL builder              | Names containing `#`, `?`, `%`, spaces, `..`, unicode and RTL override; refs `feature/x` and `v1.0`. Every output round-trips through GitHub's URL shape.                    |
| `data/fetcher.ts`        | In-flight de-duplication, the 4-request concurrency cap, abort on navigation, LRU of 200, timeout. Fallback chosen only on `SchemaError`.                                    |
| `settings.ts`            | Defaults, range validation, migration, watcher fires.                                                                                                                        |
| Content-script lifecycle | `new ContentScriptContext('test')`, run `main`, then `notifyInvalidated()`: listeners and observers are removed and a second `main` does not double-inject.                  |

Network is mocked with `vi.stubGlobal('fetch', ...)`. The extension runtime is `fakeBrowser` from
`wxt/testing/fake-browser`, reset in `beforeEach`.

## 3. Fixtures

Sources are listed in `tests/fixtures/manifest.json`, and `tests/fixtures/README.md` describes each
fixture.

- `tests/fixtures/html/`:
  - `root.html` (`git/git` root layout, with a submodule and a file symlink) and `folder.html`
    (`git/git` `contrib`, with the parent-directory row). Phase 0.
  - `root-logged-in.html`, `folder-logged-in.html`: the same pages signed in (T-GNR-012). They
    are captured from a browser with `--from-file`, with the identity replaced by `fixture-user`.
  - `pnpm fixtures:report` compares selector matches across all HTML fixtures and flags
    signed-in/out differences.
  - Still to add, in the ticket that first needs them:
    - `folder-slash-ref.html` and `empty-repo.html` (T-GNR-103)
    - `root-stripped.html`, the same page with primary hooks removed, to exercise fallbacks
      (T-GNR-102)
- `tests/fixtures/json/`: one recorded tree JSON response per case in §2:
  - `root` (directory, file, submodule, `symlink_file`)
  - `nested`
  - `capped-1000`
  - `simplified-chain`
  - `submodule`
  - `symlink-directory`
  - `slash-ref`
  - `not-found-404`
- **Capture.** `pnpm fixtures:capture [names...]` runs `scripts/capture-fixture.ts`. It fetches
  pages logged out, with a generic User-Agent and no credentials, then sanitizes them with
  `scripts/lib/sanitize.ts`:
  - **Removed:** every script except the code-view embedded JSON; every `<link>`, `<style>` and
    non-allowlisted `<meta>`; nonce, integrity, analytics, hydro, HMAC and CSRF attributes;
    authenticity tokens.
  - **Redacted:** tokens inside the JSON.
  - **Blanked:** avatar URLs, in HTML and JSON alike.
  - **Minimized:** site header and footer, command palette, rendered markdown and icon path data
    are removed, leaving only factual structure. Fixtures must stay freely licensable (module 20).
    `--reprocess` re-applies these rules to the committed signed-in fixtures.
- **Provenance.** Each fixture gets a `.md` sidecar recording the source URL, date, status, ref,
  commit and SHA-256. The fixture and its sidecar are rewritten only when the content changes, so
  re-capturing an unchanged page is byte-identical.
- **Drift check.** `pnpm fixtures:check` compares the fixtures with live GitHub and exits 1 on drift.
- **Logged-in fixtures.** These are reviewed by hand, and the real login is replaced with
  `fixture-user`, before commit.
- **Loader.** `tests/helpers/fixture.ts`:
  - `loadHtmlFixture(name)` swaps the test `document` and sets `location` to the source URL.
  - `useHtmlFixture(name)` sets up the per-test hooks.
  - `loadJsonFixture(name)` reads a JSON fixture.
  - `resetDocument()` restores an empty page.
- **Prettier.** Fixtures are excluded from Prettier, because reformatting would change their golden
  bytes.
- **Golden discipline.** Fixtures change only on purpose, in a commit that says which GitHub change
  they track. A failing fixture test is a signal about GitHub, not something to update casually.

## 4. E2E (Chromium)

- `tests/e2e/fixtures.ts` extends Playwright's `test` with a persistent context that loads
  `.output/chrome-mv3`. A `globalSetup` runs `pnpm build` first.
- PR journeys run against fixture-routed pages:
  1. Root page loads collapsed, and the toggle expands it.
  2. Folder page loads collapsed.
  3. Expanding a folder shows children; collapsing it hides them; re-expanding makes no new request.
  4. Keyboard: Enter or Space on the toggle; Right and Left arrows on a folder arrow.
  5. An error row appears when the JSON route returns 500, and Retry recovers.
  6. A hostile file name renders as text.
- Live journey, weekly: open `microsoft/vscode`, soft-navigate into `src/` through a folder link, and
  assert that the toggle exists exactly once and the listing is collapsed.

## 5. Manual release checklist

For each of Chrome stable and Firefox release:

- [ ] Logged out, public repo: root, folder page, slash-ref branch (`refined-github/sandbox`).
- [ ] Logged in, private repo: Level 2 expansion works without a token.
- [ ] A repo in a SAML-enforced organization, if available.
- [ ] Soft navigation in each direction: root to folder, folder to root, issues to code, browser
      back and forward.
- [ ] Narrow window (mobile breakpoint): arrows appear in the small-screen name cells.
- [ ] Dark, light and high-contrast themes.
- [ ] Refined GitHub installed alongside.
- [ ] Extension reload while a GitHub tab is open: no duplicate toggles.

## 6. Performance checks

| Budget (`docs/architecture.md` §5) | Check                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| First apply < 5 ms p95 (100 rows)  | Debug builds record `performance.measure('gnr:apply')`; the Playwright test reads it from the page and asserts. |
| Bundle < 30 KB                     | CI step reads `.output/chrome-mv3/content-scripts/content.js` size.                                             |
| Re-expand < 16 ms, 0 requests      | Playwright: request counter on the route, timing via `performance.now()` in the page.                           |

## 7. Gates

The CI order:

1. `format:check`
2. `lint` (zero warnings)
3. `typecheck`
4. `test` with coverage
5. `build`
6. `build:firefox`
7. `lint:firefox`
8. E2E (Chromium)

Coverage floors start in Phase 2: 80% lines for `src/github/` and `src/data/`, and 60% overall. Every
fixed bug gets a regression test that stays.
