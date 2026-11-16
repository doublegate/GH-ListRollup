# GH-ListRollup: Research Report

**Date:** 2026-11-15 | **Mode:** autonomous research (built on `initial-concept.md`)
**Scope:** everything needed to build a Chrome and Firefox MV3 extension that collapses GitHub's repository
file listing to one line and expands folders inline as a nested tree.

## How to read this report

This report consolidates ten topic files, each with its own numbered source list. Citations take the
form **[file Sn]**: [DOM S1] means source S1 in `github-code-view-dom.md`. Short names:

| Short name | File |
|---|---|
| DOM | `github-code-view-dom.md` |
| NAV | `github-navigation-events.md` |
| DATA | `github-data-sources.md` |
| CHR | `chrome-mv3.md` |
| FFX | `firefox-mv3.md` |
| XB | `cross-browser-differences.md` |
| STORE | `store-publishing.md` |
| WXT | `wxt-framework.md` |
| TEST | `testing-extensions.md` |
| PRIOR | `prior-art.md` |

Section 9 lists the primary URLs. All observations of github.com were made on 2026-11-15 while logged
out; section 7 lists what still needs checking while logged in.

The research drew on about 70 distinct sources:

- **Direct observation:** curl captures of github.com pages, JSON endpoints and GitHub's own JS bundles.
- **Official documentation:** docs.github.com, developer.chrome.com, MDN, extensionworkshop.com, the
  Mozilla add-ons blog, wxt.dev, playwright.dev and Microsoft Learn.
- **Source code of maintained extensions:** Refined GitHub, Tako, Gitako and Octotree.
- **Secondary:** a few forum and community threads, used only to support other sources.

---

## 1. Executive summary

The feature can be built with today's platforms, and the data it needs is available without tokens.

- **Level 1, collapsing the whole listing,** is a pure DOM and CSS change on a stable container,
  `[data-testid="directory-content"]` [DOM §5]. Refined GitHub shipped almost exactly this feature
  (`toggle-files-button`) from 2019 to 2024 [PRIOR S4, S5]. Its history shows two things: users
  wanted it, and GitHub's move to React kept breaking DOM-dependent implementations.
- **Level 2, the inline tree,** needs one request per expanded folder. GitHub's own code view gets
  folder contents from a same-origin JSON endpoint, `GET /<o>/<r>/tree/<ref>/<path>` with
  `Accept: application/json` [DATA S2, S4]. An MV3 content script can call it as the page origin, so
  the user's session covers private repositories, with no token and no API quota [DATA S9, S10].
  The endpoint is undocumented, which is the project's main structural risk. The documented REST
  Contents API is the fallback, but it allows only 60 requests per hour without a token [DATA S6, S8].
- **WXT 0.21.5 with TypeScript** builds both browser packages from one codebase. It needs two
  explicit settings: MV3 for Firefox, which WXT otherwise builds as MV2, and a Firefox-only
  `browser_specific_settings.gecko` block that includes `data_collection_permissions` [WXT §2,
  FFX S1-S3].
- **GitHub navigates without full page loads,** using Turbo plus a React router wrapped in its own
  `soft-nav:*` events [NAV S1]. The content script must therefore load on all of github.com and
  re-apply itself idempotently on those events, plus `turbo:render` and a scoped MutationObserver
  [NAV §6, PRIOR S2].

## 2. The GitHub surface

### 2.1 Page structure

The repository root and folder pages render the same React "code-view" app
(`react-app[app-name="code-view"]`). Both are server-rendered and then hydrated [DOM S1, S2, S7]. The
listing is a table inside `div[data-hpc]`, labelled by a screen-reader-only heading
`h2#folders-and-files` [DOM §2]:

```text
[data-testid="directory-content"] > table[aria-labelledby="folders-and-files"]
  tbody > tr.react-directory-row          one per entry (files too)
    td.react-directory-row-name-cell-small-screen   } duplicated name cells
    td.react-directory-row-name-cell-large-screen   } (one shown by CSS)
      .react-directory-filename-cell a[aria-label="<name>, (Directory)" | "<name>, (File)"]
  tr[data-testid="view-all-files-row"]    mobile truncation footer
```

The two layouts differ in a few places [DOM §3, §4]:

| | Repository root | Folder page (`/tree/...`) |
|---|---|---|
| Latest-commit bar | Inside the listing box, above the table | A separate box directly above the listing |
| Branch picker id | `#ref-picker-repos-header-ref-selector` | `...-selector-wide`, inside a sticky breadcrumb header |
| First row | First entry | A parent-directory row (`a[data-testid="up-tree"]`) |
| Other | Table has a hashed `OverviewTable*` class | Holds the native file-tree sidebar `#repos-file-tree-sidebar` |

Details that shape the design:

- Row ids (`folder-row-N`) are indexes, not types. The folder/file distinction must come from the
  link's `aria-label` suffix, the `octicon-file-directory-fill` icon, or `/tree/` vs `/blob/` in the
  href [DOM §2].
- Single-child folder chains render as one "simplified" row whose href points to the deepest folder.
  Submodule and symlink entries also exist [DOM §2, DATA S3].
- Commit columns arrive later, from a deferred request, so React re-renders rows after first paint.
  Injected nodes can be lost and must be re-applied [DOM §2, PRIOR S6].
- Hashed CSS-module and Primer classes (`Box_3__eg9tXU`, `prc-*-<hash>`) change per deploy and must
  never be selectors. Refined GitHub relies on `react-directory-*` classes, `data-testid` and
  `aria-labelledby="folders-and-files"` [DOM §5, PRIOR S1-S3].

**Design consequence.** On both layouts, the latest-commit bar is the line directly above the rows,
which makes it the "single header line" of the concept. Collapsing `[data-testid="directory-content"]`
alone keeps that bar and the README visible. This matches Refined GitHub's original placement of its
toggle [DOM §3, PRIOR S5]. Specified in `docs/dom-integration.md` §2.1.

### 2.2 Navigation

There is no PJAX. GitHub runs Turbo Drive and a React router side by side, and wraps both in custom
events on `document`: `soft-nav:start`, `:success`, `:end`, `:render`, `:react-done` and `:payload`
[NAV S1]. Refined GitHub re-runs on `turbo:render` and `soft-nav:react-done`, and also uses
selector-scoped observers [NAV S3, PRIOR S2, S3].

WXT's `wxt:locationchange` fires when the URL changes, which is before GitHub renders the new page.
Where the Navigation API exists, it is driven by the `navigate` event; elsewhere WXT polls the URL
once a second [WXT S4]. That makes it a supplement, not the trigger.

A content script cannot reliably read a page-world event's payload from the isolated world, so the
extension relies on event names only [NAV §5, FFX S9].

### 2.3 CSP

GitHub sends `style-src 'unsafe-inline' github.githubassets.com` and blocks inline scripts
[DOM §6].

- **Chrome** exempts DOM created from the isolated world from page CSP [DOM S13].
- **Firefox** still applies page CSP to some content-script-inserted DOM; Mozilla bug 1267027 is open
  [DOM S12].

So: inject styles through manifest `content_scripts.css`, use no inline `<style>` and no inline
`style` attributes, and never inject `<script>`.

## 3. Data strategy

| Source | Auth | Limit | Caveat | Use |
|---|---|---|---|---|
| Embedded `react-app.embeddedData` JSON | none | current folder only | Goes stale after soft navigation; shape differs logged in vs out [DATA §1, PRIOR S10] | Not used |
| Same-origin tree JSON | session cookie, implicit | 1,000 items per folder, no paging; no published rate limit [DATA S2] | Undocumented; route key differs by page type; no CORS, so same-origin only | **Primary** |
| REST `contents/{path}?ref=` | none or token | 60/h per IP unauthenticated, 5,000/h with a token; 1,000 entries [DATA S6, S8] | Private repos need a token | Optional fallback |
| REST `git/trees` recursive | none or token | 100,000 entries / 7 MB, `truncated` flag [DATA S7] | Wasteful for lazy expansion; Octotree hit the truncation [PRIOR S11] | Not used |
| `tree-list/<oid>` | session | files only, 1.5 MB on vscode [DATA S3] | No folder entries | Not used |

Observed response of the primary source:

- `payload.codeViewTreeRoute.tree.items[]`, each with `name`, `path`, `contentType` and
  `hasSimplifiedPath`, plus `totalCount` and `refInfo` (`name`, `currentOid`).
- `404` for a missing path, and also for a missing repo or, logged out, a private one.
- It worked with only the `Accept` header. GitHub's own client also sends `X-Requested-With` and
  `GitHub-Verified-Fetch: true`, so the extension sends the same [DATA S2, S4]. Refined GitHub and
  Tako both make same-origin, cookie-authenticated requests like this from content scripts
  [DATA S11, PRIOR S9].
- Refs may contain `/`, as verified against a test repository's `branch/with/slashes`. The extension
  must take the ref from row hrefs or `refInfo`, never from splitting the URL [DATA S2].

Where each kind of fetch runs:

- In MV3, content-script requests in both Chrome and Firefox are made "on behalf of the web origin",
  under the page's CORS rules [CHR S8, FFX S9]. Firefox's MV2-era `content.fetch` does not exist in
  MV3 [DATA S10].
- So same-origin github.com requests run in the content script. Requests to `api.github.com`, which
  send `Access-Control-Allow-Origin: *` [DATA S5], run in the background script, where host
  permissions apply and the token stays [CHR S8, XB §3].

Decision: ADR 0002 (`docs/adr/0002-same-origin-tree-json.md`).

## 4. Platform matrix

| Topic | Chrome MV3 | Firefox MV3 |
|---|---|---|
| Background | `service_worker` [CHR S4] | `background.scripts` event page; no service-worker background [FFX S4, XB S1] |
| Extension id | Assigned by the Chrome Web Store | `browser_specific_settings.gecko.id` required [FFX S1] |
| Data declaration | Privacy practices tab in the CWS dashboard [STORE S4] | `data_collection_permissions: {required: ["none"]}`; required for new AMO add-ons since 2025-11-03, honoured from Firefox 140 [FFX S1-S3, S11] |
| Host permission grant | At install; the user can withhold it [CHR S6, S7] | At install from 127; the user can revoke it [FFX S6, S7] |
| `browser` namespace | Chrome 148+ (WXT supplies a `browser` import either way) [CHR S10, XB S2] | Native |
| Promise-returning `onMessage` | Chrome 148+ only, so use `sendResponse` + `return true` [XB S2] | Supported |
| `storage.local` `setAccessLevel` | 140+ [CHR S5] | Not available; irrelevant if the token never leaves the background |
| Minimum version chosen | Chrome 121 | Firefox 142. Desktop honours `data_collection_permissions` from 140, but Android only from 142, and `web-ext lint` rejects 140 for that reason (verified on the skeleton build) |

Store requirements:

- **Chrome Web Store** [STORE S1-S8]:
  - one-time registration fee
  - single-purpose statement
  - a justification for each permission
  - a "no remote code" declaration
  - privacy disclosures, including a note that an optional locally stored token counts as user data
  - review takes days to weeks
- **AMO** [STORE S9-S12]:
  - a source-code upload with every version, because the code is bundled
  - exact build instructions and a reproducible build (reviewers default to Ubuntu 24.04, Node
    24.14.0, npm 11.9.0)
  - `web-ext lint`
  - the revised Add-on Policies that take effect 2026-12-01, which require accurate data-practice
    declarations
- **Edge Add-ons** is optional: the Chrome package is reused and there is no fee [STORE S15, S16].

## 5. Toolchain

All versions checked with `npm view` on 2026-11-15 [WXT S1, TEST S1]:

| Package | Version | Note |
|---|---|---|
| `wxt` | 0.21.5 | Node >= 22; `vite` 8.3.8 is a required peer |
| `@wxt-dev/storage` | 1.3.0 | Typed `storage.defineItem` with versions and migrations [WXT S12] |
| `typescript` | 6.0.3 | Not 7.x: `typescript-eslint` 8.72.2 requires `<6.1.0` |
| `typescript-eslint` / `eslint` / `@eslint/js` | 8.72.2 / 10.15.0 / 10.0.1 | Flat config |
| `prettier` | 3.10.1 | |
| `vitest` / `@vitest/coverage-v8` / `happy-dom` | 5.1.0 / 5.1.0 / 21.0.4 | `WxtVitest()` plugin; `fakeBrowser` from `wxt/testing/fake-browser` [WXT S11, TEST S9] |
| `@playwright/test` | 1.65.1 | Bundled Chromium (`channel: 'chromium'`), works headless [TEST S2] |
| `web-ext` | 10.8.0 | `lint`, `run`, `sign` [STORE S13] |
| Node / pnpm | 26.13.1 LTS / 12.21.0 | |

WXT facts that shape the build [WXT §2-§6]:

- `manifest` can be a function of the target browser, which is where the Firefox-only keys go.
- `wxt build -b firefox --mv3` builds Firefox as MV3. `wxt zip -b firefox` also produces the AMO
  sources zip; in v0.21 its include list became a plain allowlist.
- `wxt prepare` runs at `postinstall`.
- `webextension-polyfill` was removed in v0.20 [XB S4].
- `ContentScriptContext` provides `ctx.addEventListener`, `ctx.signal` and `ctx.onInvalidated`, which
  together prevent duplicate injection when the extension reloads.

Firefox end-to-end testing is the gap: Playwright still cannot load Firefox extensions [TEST S3]. The
options are:

- `web-ext run` for manual smoke tests
- the community package `playwright-webextext` [TEST S4]
- WebDriver BiDi `webExtension.install`, through WebdriverIO [TEST S5, S6]

## 6. Prior art and lessons

| Project | What it does | Data | License | Lesson |
|---|---|---|---|---|
| Refined GitHub `toggle-files-button` (2019-2024) | Collapsed the file listing with a chevron in the latest-commit box | DOM only | MIT | Proves Level 1. It broke repeatedly as GitHub moved to React and had duplicate-injection bugs; it was removed in PR #7741 after being restored twice [PRIOR S4, S5]. Build idempotency and fixture tests in from day one. |
| Refined GitHub (general) | Hundreds of GitHub DOM features | same-origin fetch, REST with a token | MIT | One selectors module, `selector-observer`, re-run on `turbo:render` and `soft-nav:react-done`, `github-url-detection` for page types [PRIOR S1-S3, S7]. |
| Tako (2026) | Inline folder expansion in the listing | GraphQL with a token; same-origin `tree-commit-info` | MIT | Closest to Level 2, but it hides GitHub's table and reimplements it, and needs a token [PRIOR S9]. This project keeps GitHub's table and adds rows instead. |
| Gitako | Sidebar tree | Embedded page JSON plus the REST API | MIT | The embedded JSON shape differs logged in vs out; validate and fail soft. Has a scheduled test for selector drift [PRIOR S10, TEST S10]. |
| Octotree | Sidebar tree | REST recursive tree | AGPL / proprietary | Recursive trees truncate on large repos. Its code must not be reused [PRIOR S11]. |

## 7. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | GitHub changes the listing markup | High (it has before) | Feature off | Ranked selector fallbacks; confidence gate does nothing instead of breaking; fixture tests; weekly live probe (`docs/dom-integration.md` §6) |
| R2 | Tree JSON endpoint changes or disappears | Medium | Level 2 off | Defensive parsing; `SchemaError` triggers the REST fallback (ADR 0002) |
| R3 | React re-render drops injected nodes, or early edits cause a hydration mismatch | High | Flicker, lost arrows | Extension-owned sibling nodes and rows; idempotent re-apply; in-memory expansion state |
| R4 | A hidden listing with no toggle | Low | Severe UX | Toggle inserted before the hide class; 4-second watchdog on the pending attribute |
| R5 | Unverified logged-in behaviour: private repos through the session, SAML-enforced orgs, Firefox Total Cookie Protection on same-origin requests | Medium | Level 2 fails on private repos | Phase 2 spike T-GNR-201, tested logged in on both browsers |
| R6 | Undocumented throttling of github.com JSON routes | Low | 429s | One request per click, at most 4 concurrent, no prefetch |
| R7 | AMO treats the optional token as transmitted `authenticationInfo` | Medium | Declaration mismatch, rejected review | Refined GitHub ships `none` with a token (precedent only). If questioned, declare `optional: ["authenticationInfo"]` and ask consent when a token is saved, or drop the fallback [FFX S13, STORE S12] |
| R8 | AMO reproducible-build mismatch | Medium | Rejected review | Pinned toolchain, committed lockfile, no timestamps or git hashes in the bundle |

## 8. Open questions

1. Logged-in DOM differences on both layouts. Observations so far were logged out only [DOM §7].
2. Does the same-origin tree JSON work for private repos in Firefox MV3, given cookie partitioning?
   For SAML-enforced orgs? (R5)
3. Does the Navigation API's `navigate` event reach Firefox content scripts? If not, WXT falls back
   to 1-second polling [WXT S4].
4. Does GitHub simplify single-child chains inside nested responses as well as at the root?
   [DATA open question 5]
5. Keep the `api.github.com` fallback in v1, or ship without it to minimise permissions and avoid
   R7? Decide at the end of Phase 2 from measurements.
6. Should the collapsed header optionally hide the commit text and keep only the arrow and
   "N items" ("compact header", Phase 3)?
7. Firefox for Android: is GitHub's mobile DOM the same? Not tested; out of scope for v1.

## 9. Primary references

- GitHub
  - Code view engineering blog: <https://github.blog/engineering/architecture-optimization/crafting-a-better-faster-code-view/>
  - REST repository contents: <https://docs.github.com/en/rest/repos/contents>
  - REST Git trees: <https://docs.github.com/en/rest/git/trees>
  - REST rate limits: <https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api>
  - REST CORS: <https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests>
- Chrome
  - Content scripts: <https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts>
  - Network requests: <https://developer.chrome.com/docs/extensions/develop/concepts/network-requests>
  - Storage: <https://developer.chrome.com/docs/extensions/reference/api/storage>
  - Permissions: <https://developer.chrome.com/docs/extensions/reference/api/permissions>
  - Web Store policies: <https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines>
- Firefox
  - `browser_specific_settings`: <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings>
  - Built-in data consent: <https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/>
  - Content scripts: <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts>
  - Source code submission: <https://extensionworkshop.com/documentation/publish/source-code-submission/>
  - Add-on Policies: <https://extensionworkshop.com/documentation/publish/add-on-policies/>
- Tooling
  - WXT content scripts: <https://wxt.dev/guide/essentials/content-scripts.html>
  - WXT browser targets: <https://wxt.dev/guide/essentials/target-different-browsers.html>
  - WXT unit testing: <https://wxt.dev/guide/essentials/unit-testing>
  - Playwright Chrome extensions: <https://playwright.dev/docs/chrome-extensions>
  - `web-ext` reference: <https://extensionworkshop.com/documentation/develop/web-ext-command-reference/>
- Prior art
  - Refined GitHub: <https://github.com/refined-github/refined-github>
  - Refined GitHub PR #7741: <https://github.com/refined-github/refined-github/pull/7741>
  - Tako: <https://github.com/brumm/tako>
  - Gitako: <https://github.com/EnixCoda/Gitako>
  - Octotree: <https://github.com/ovity/octotree>
