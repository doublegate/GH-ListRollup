# Testing Browser Extensions: Unit, E2E and Lint

Retrieved: 2026-11-15

Scope: how to test a WXT content-script extension that changes github.com, with unit tests (Vitest),
end-to-end tests in Chromium and Firefox, and the lint and format gates.

## Sources

- [S1] npm registry, `npm view <pkg> version|time|engines|peerDependencies`, run 2026-11-15: exact
  versions in the table below.
- [S2] https://playwright.dev/docs/chrome-extensions: Playwright's official guide to testing Chrome
  extensions (persistent context, `channel: 'chromium'`, service-worker ID lookup).
- [S3] https://github.com/microsoft/playwright/issues/7297 and #36728: the long-running "Support
  running extensions with Firefox" request. #36728 was folded into #7297, and the 2026 comments point
  to workarounds.
- [S4] https://github.com/ueokande/playwright-webextext: a community package that adds temporary
  Firefox add-on installs to Playwright (v0.0.5, MIT).
- [S5] https://firefox-source-docs.mozilla.org/remote/webdriver-bidi/Extensions.html: Firefox
  WebDriver BiDi extension commands, with temporary as the default install and `moz:permanent`
  requiring a signed add-on.
- [S6] https://webdriver.io/docs/extension-testing/web-extensions/: WebdriverIO guide covering Chrome
  `--load-extension`, Firefox `installAddOn`, and BiDi `installExtension`.
- [S7] https://extensionworkshop.com/documentation/develop/web-ext-command-reference/: `web-ext`
  v10 command reference (`run`, `lint`, `build`, `sign`).
- [S8] https://wxt.dev/guide/essentials/unit-testing: the `WxtVitest` plugin and what it configures.
- [S9] https://wxt.dev/guide/resources/upgrading: v0.21 changes, including the removed `wxt/testing`
  barrel and fake-browser v2.
- [S10] https://github.com/EnixCoda/Gitako/blob/develop/e2e/drift.selectors.spec.ts: a real
  extension's "selector drift tripwire" E2E spec against live GitHub.
- [S11] https://github.com/brumm/tako/blob/main/package.json: a 2026 GitHub-file-tree extension using
  Vitest, `@vitest/browser-playwright`, happy-dom and msw.
- [S12] https://github.com/microsoft/playwright/releases: Playwright release list (v1.65.1,
  2026-11-13).

## Current versions (checked 2026-11-15 via npm [S1])

| Package | Version | Published | Engines / peers |
|---|---|---|---|
| `vitest` | 5.1.0 | 2026-11-02 | node `^22.12 \|\| ^24 \|\| >=26`; peer vite `^6.4 \|\| ^7 \|\| ^8`; `happy-dom`/`jsdom` optional peers |
| `@vitest/coverage-v8` | 5.1.0 | - | must match the vitest version exactly |
| `@playwright/test` | 1.65.1 | 2026-11-13 | node `>=20` |
| `playwright` | 1.65.1 | 2026-11-13 | |
| `web-ext` | 10.8.0 | 2026-10-15 | node `>=20` in package.json; the v10 docs say Node 22+ [S7] |
| `typescript` | 7.0.2 latest / **6.0.3 to pin** | - | typescript-eslint peer is `<6.1.0` |
| `eslint` | 10.15.0 | 2026-11-13 | flat config only |
| `@eslint/js` | 10.0.1 | - | |
| `typescript-eslint` | 8.72.2 | - | peers eslint `^8.57 \|\| ^9 \|\| ^10`, typescript `>=4.8.4 <6.1.0` |
| `globals` | 17.14.0 | - | browser globals for the flat config |
| `prettier` | 3.10.1 | 2026-11-12 | |
| `happy-dom` | 21.0.4 | 2026-10-20 | |
| `jsdom` | 31.0.1 | 2026-11-13 | |
| `vite` | 8.3.8 | - | |
| `playwright-webextext` | 0.0.5 | 2026-04 | community, pre-1.0 |
| `puppeteer` | 25.17.0 | - | alternative for Firefox through BiDi |

## Layer 1: unit tests (Vitest, WxtVitest, happy-dom)

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';
export default defineConfig({
  plugins: [WxtVitest()],
  test: { environment: 'happy-dom', restoreMocks: true },
});
```

- `WxtVitest` swaps in an in-memory `browser` (`@webext-core/fake-browser`), applies
  `wxt.config.ts` Vite settings, sets up auto-imports, and defines `import.meta.env.BROWSER`/`FIREFOX`
  plus the aliases [S8]. Import `fakeBrowser` from `wxt/testing/fake-browser`, since the barrel
  `wxt/testing` was removed in v0.21 [S9]. Call `fakeBrowser.reset()` in `beforeEach`. In
  fake-browser v2, mocked `onMessage` listeners cannot return promises [S9].
- Most of the logic here is DOM transformation, so the useful unit tests run against **saved GitHub
  HTML fixtures**. Load a captured listing (repository root, nested folder, empty repository, a
  single-file repository, signed-in and anonymous variants) into happy-dom, run the transform, and
  assert on the result: rows hidden, toggle present, child rows inserted with correct indentation and
  `aria-expanded`. Commit the fixtures and regenerate them deliberately (golden-vector discipline).
  Fixtures are copies of github.com markup. Strip user-specific data (tokens, `octolytics` meta,
  avatars) before committing them (open question Q2).
- Mock network calls with `vi.stubGlobal('fetch', ...)` or msw. Tako uses msw [S11].
- Invalidation: build `new ContentScriptContext('test')`, run `main(ctx)`, call
  `ctx.notifyInvalidated()`, and assert that listeners and observers are gone.
- happy-dom against jsdom. Both are optional Vitest peers [S1]. happy-dom is faster and is what Tako
  uses [S11]. It lacks layout, so `IntersectionObserver` and `animationstart` do not behave as in a
  real browser. An animation-start selector observer cannot be unit-tested this way. Cover it with
  Vitest browser mode (`@vitest/browser-playwright`, which Tako also uses [S11]) or with E2E.

## Layer 2: E2E in Chromium (Playwright)

The official recipe [S2]:

```ts
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium', // the bundled Chromium; makes headless work with extensions
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
```

- "Extensions only work in Chromium when launched with a persistent context" [S2].
- **Use the bundled Chromium.** "Google Chrome and Microsoft Edge removed the command-line flags
  needed to side-load extensions" [S2]. Branded Chrome cannot be the E2E target.
- `channel: 'chromium'` allows headless runs with extensions [S2], so this works in CI without xvfb.
- The extension ID usually comes from `context.serviceWorkers()` / `waitForEvent('serviceworker')`
  [S2]. **A content-script-only build has no service worker.** Tests do not need the ID: navigate to
  `https://github.com/<owner>/<repo>` and assert on the injected DOM. If the ID is ever needed (an
  options page), add a background entrypoint or read it from `chrome://extensions`. MV3 service
  workers suspend after about 30 s idle, and `evaluate()` calls in flight then throw "Service worker
  restarted" [S2].
- Point `dist` at `.output/chrome-mv3` after `wxt build`. A Playwright `globalSetup` can run the
  build.
- Playwright fixtures: extend `test` with a `context` fixture (persistent, extension loaded) and a
  `page` fixture taken from it [S2].

### Live github.com in CI

- E2E against live github.com is the real oracle but is flaky: rate limits, anonymous versus
  signed-in DOM differences, and A/B feature previews. Gitako runs a dedicated **"selector drift
  tripwire"** spec that checks every DOM selector against a known URL with an expected count, so a
  GitHub redesign "fails first, before the functional tests downstream" [S10]. It also skips probes
  honestly when a feature-preview surface is absent [S10]. Adopt this pattern: one drift spec on a
  schedule (nightly) and functional E2E on PRs.
- For deterministic PR CI, serve saved fixture HTML through `page.route('https://github.com/**', ...)`
  so the URL still matches the content script's `https://github.com/*` pattern. Saved fixtures do not
  reproduce GitHub's client-side soft navigation, so keep at least one live soft-navigation test.
- Run anonymously unless the account-dependent DOM matters. Never commit GitHub credentials. If a
  signed-in run is needed, use a dedicated test account's storage state from CI secrets.

## Layer 3: E2E in Firefox

Playwright still has **no first-class Firefox extension loading**. The tracking issue #7297 is closed,
and its 2026 comments point to workarounds [S3]. The options:

1. **`web-ext run`** (`--target firefox-desktop`, `--firefox <path|nightly|deved>`, `--start-url`)
   loads the unpacked build as a temporary add-on [S7]. It is good for manual smoke tests and is what
   `wxt dev -b firefox` drives. It is not an assertion framework.
2. **`playwright-webextext`** installs a temporary add-on over the Remote Debugging Protocol, which
   avoids signing [S3][S4]. It is pre-1.0 (0.0.5) and community-maintained, and it runs against
   Playwright's patched Firefox build, not branded Firefox. Feasible, but carries maintenance risk.
3. **WebDriver BiDi `webExtension.install`**, used through WebdriverIO (`browser.installExtension`,
   which needs no extra Firefox arguments) or Puppeteer's Firefox support [S5][S6]. Unsigned add-ons
   can only be installed temporarily, which is the default, and `moz:permanent` needs a signed add-on
   [S5]. This is the standards-track path for branded Firefox.

Recommendation: Playwright and Chromium for most E2E. One thin Firefox smoke suite through option 3
(or 2) that checks the content script injects, collapses the listing, and survives a soft navigation.
Run it nightly or before release if it proves flaky.

## Lint and format gates

- **`web-ext lint -s .output/firefox-mv3`** runs AMO's linter on the built Firefox output. Use
  `--warnings-as-errors` (`-w`) so warnings fail the gate, `--output json` for machine-readable
  output, and `--self-hosted` only for self-distributed builds [S7]. Run it in CI after
  `wxt build -b firefox`.
- ESLint 10 uses flat config only (`eslint.config.js`/`.mjs`). Minimal shape:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(
  { ignores: ['.output/', '.wxt/'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  { languageOptions: { globals: globals.browser, parserOptions: { projectService: true } } },
);
```

  WXT auto-imports: v0.21 generates `eslint-auto-imports.mjs` for ESLint 9+ when
  `imports.eslintrc.enabled` is `true`/`'auto'` [S9]. Using explicit `#imports` avoids needing it.
  The `tseslint.config` helper is the long-standing API. Newer typescript-eslint releases may prefer
  `defineConfig` from `eslint/config` (unverified for 8.72).
- Run `prettier --check .`.
- Type check with `wxt prepare && tsc --noEmit`.

## Suggested CI order

`pnpm install --frozen-lockfile` (postinstall runs `wxt prepare`), then `prettier --check`, then
`eslint . --max-warnings 0`, then `tsc --noEmit`, then `vitest run --coverage`, then `wxt build` and
`wxt build -b firefox`, then `web-ext lint -w -s .output/firefox-mv3`, then
`playwright test --project=chromium`, then `wxt zip` and `wxt zip -b firefox`. Gitleaks and
dependency audits follow the workspace conventions.

## Unverified claims

- U1: Headless Chromium with `channel: 'chromium'` runs content scripts on live github.com identically
  to headed mode. The docs only say extensions work headless [S2].
- U2: Whether `playwright-webextext@0.0.5` works with Playwright 1.65 [S4].
- U3: The exact WebdriverIO and Puppeteer API names for Firefox BiDi extension install in their
  current majors [S6]. Puppeteer's signature was not confirmed from primary docs.

## Open questions

- Q1: Is there a Firefox E2E budget? Option 2 is the cheapest to adopt and option 3 the most durable.
- Q2: Fixture licensing and privacy. Saved github.com HTML is GitHub's markup. Commit it with
  user-identifying data stripped, or regenerate it in CI from a public test repository?
- Q3: Should the live-GitHub drift spec use a dedicated, stable public test repository with known
  nesting (empty folder, single-child chains, submodule, symlink) owned by the project?
