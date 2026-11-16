# WXT Framework Reference for GH-ListRollup

Retrieved: 2026-11-15

Scope: the parts of WXT (and adjacent toolchain packages) that GH-ListRollup needs. That means a
content-script-only Manifest V3 extension for Chrome and Firefox that changes `github.com` repository
code-view pages and has to survive GitHub's soft navigation.

## Sources

- [S1] npm registry, `npm view <pkg> version|time|engines|peerDependencies`, run 2026-11-15: the exact
  current versions and requirements in the table below.
- [S2] https://wxt.dev/guide/essentials/content-scripts.html: the content-script guide (ctx, UI
  helpers, isolated and main world, SPA handling).
- [S3] https://wxt.dev/api/reference/wxt/utils/content-script-context/classes/contentscriptcontext:
  the `ContentScriptContext` API reference (`addEventListener`, `onInvalidated`, timers).
- [S4] https://github.com/wxt-dev/wxt/blob/main/packages/wxt/src/utils/internal/location-watcher.ts:
  the source of the watcher behind `wxt:locationchange`.
- [S5] https://wxt.dev/guide/essentials/config/manifest: manifest config, including the function form
  that takes the target browser.
- [S6] https://wxt.dev/guide/essentials/target-different-browsers.html: `-b`, `--mv2`/`--mv3`, the
  default manifest version per browser, and `import.meta.env.BROWSER`.
- [S7] https://wxt.dev/guide/resources/upgrading: breaking changes in v0.20 and v0.21 (polyfill
  removal, peer dependencies, the Node floor, sources-zip semantics).
- [S8] https://wxt.dev/guide/essentials/project-structure.html: directory layout and the `srcDir`
  option.
- [S9] https://wxt.dev/guide/installation.html: the package.json scripts, including
  `postinstall: wxt prepare`.
- [S10] https://wxt.dev/guide/essentials/publishing: `wxt zip`, the Firefox sources zip, and AMO notes.
- [S11] https://wxt.dev/guide/essentials/unit-testing: the `WxtVitest` plugin and fake browser.
- [S12] https://wxt.dev/storage.html: `@wxt-dev/storage`, `storage.defineItem`, fallbacks and watchers.
- [S13] https://wxt.dev/blog/2024-12-06-using-imports-module: the `#imports` virtual module and how
  it maps onto `wxt/utils/*` subpaths.
- [S14] https://github.com/wxt-dev/wxt/releases/tag/wxt-v0.21.5: the v0.21.5 release notes
  (2026-10-26).
- [S15] `wxt@0.21.5` package type definitions (`dist/types.d.mts`, inspected from `npm pack`): the
  `manifestVersion`, `targetBrowsers` and `webExt.disabled` options.
- [S16] https://blog.mozilla.org/addons/2025/10/23/data-collection-consent-changes-for-new-firefox-extensions/
  and https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/: the
  `data_collection_permissions` requirement for new AMO listings.
- [S17] https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions
  and https://blog.mozilla.org/addons/2024/05/14/manifest-v3-updates/: how Firefox MV3 grants host
  permissions at install (Firefox 127+) and lets users revoke them.
- [S18] https://groups.google.com/a/mozilla.org/g/dev-platform/c/2U3cwQgCWBY: Mozilla's intent to ship
  the Navigation API (Firefox 147).
- [S19] https://nodejs.org/dist/index.json: Node release index (v26.13.x is LTS "Lithium").

## Current versions (checked 2026-11-15 via npm [S1])

| Package | Version | Published | Notes |
|---|---|---|---|
| `wxt` | 0.21.5 | 2026-10-26 | engines `node >=22`; peers `vite ^6.3.4 \|\| ^7 \|\| ^8`, `typescript >=5.4` (optional), `web-ext >=9.2.0` (optional), `eslint ^8.57 \|\| ^9 \|\| ^10` (optional) |
| `@wxt-dev/browser` | 0.3.7 | 2026-10-28 | backs WXT's `browser` global; types derived from `@types/chrome` |
| `@wxt-dev/storage` | 1.3.0 | 2026-10-04 | a dependency of `wxt` (`^1.0.0`), exposed as `wxt/utils/storage` |
| `vite` | 8.3.8 | - | required peer of `wxt`; add it to devDependencies explicitly |
| `typescript` | 7.0.2 latest; **6.0.3 recommended** | 6.0.3: 2026-04-16 | `typescript-eslint@8.72.2` has peer `typescript >=4.8.4 <6.1.0`, see below |
| `web-ext` | 10.8.0 | 2026-10-15 | v10 requires Node 22+ |
| `webextension-polyfill` | 0.12.0 | - | **not needed**: WXT dropped it in v0.20 [S7] |
| `pnpm` | 12.21.0 | - | WXT documents pnpm, npm, yarn and bun equally [S9] |
| Node.js | 26.13.1 (LTS "Lithium") | 2026-11-10 | [S19]; the local machine also runs v26.13.1 |

### TypeScript version caveat

`typescript@latest` is 7.0.2, the native (Go) compiler line. `typescript-eslint@8.72.2` declares
`typescript: ">=4.8.4 <6.1.0"` [S1], so typed linting will not install cleanly against TS 7. Pin
**`typescript@6.0.3`** until typescript-eslint widens that range. WXT itself only needs `>=5.4`
[S7]. This is a decision point. Re-check before bootstrapping (open question Q1).

## Project layout

WXT's default layout is flat [S8]: `entrypoints/`, `public/` (copied verbatim), `assets/` (processed
by Vite), `components/`, `utils/` (both auto-imported), `modules/`, and the generated `.wxt/` (tsconfig
and types) and `.output/` (build artifacts). The root holds `wxt.config.ts`, an optional
`web-ext.config.ts`, `app.config.ts`, `.env*`, `package.json` and `tsconfig.json`. Setting
`srcDir: 'src'` moves `entrypoints/`, `utils/`, `components/`, `assets/` and `app.config.ts` under
`src/`. `public/`, `modules/`, config and env files stay at the root [S8].

Suggested layout for this project (a proposal, not prescribed by WXT):

```text
wxt.config.ts
vitest.config.ts
public/icon/*.png
src/entrypoints/github.content/index.ts   # the one content script
src/entrypoints/github.content/style.css
src/utils/...                              # page detection, DOM helpers, fetch/cache
tests/unit/...   tests/e2e/...
```

The generated scripts [S9] are `dev`, `dev:firefox`, `build`, `build:firefox`, `zip`, `zip:firefox`,
and **`"postinstall": "wxt prepare"`**. `wxt prepare` generates `.wxt/` types and the tsconfig the
root `tsconfig.json` extends, so CI must run it, either through postinstall or explicitly, before
`tsc --noEmit`. Add `"compile": "tsc --noEmit"` yourself. The installation page does not list it.

## Manifest generation and per-browser builds

- `manifest` can be an object or a function `({ browser, manifestVersion, mode, command }) => ({...})`
  [S5]. Use the function form for Firefox-only keys.
- `-b firefox` selects the target. **WXT defaults Firefox and Safari to MV2 and everything else to
  MV3** [S6]. Firefox therefore needs either `--mv3` on every command or `manifestVersion: 3` in the
  config. The config option exists in 0.21.5 and the CLI flag overrides it [S15].
- `targetBrowsers: ['chrome', 'firefox']` narrows the type of `import.meta.env.BROWSER` [S15].
  Runtime flags include `import.meta.env.BROWSER`, `import.meta.env.FIREFOX` and
  `import.meta.env.MANIFEST_VERSION` [S6].
- Each entrypoint accepts `include` and `exclude` browser lists, and `filterEntrypoints` limits a
  build [S6].
- WXT generates `content_scripts` from `defineContentScript` options. Importing a CSS file in the
  content script adds it to that content script's `css` array [S2].

Firefox specifics the config has to carry:

- `browser_specific_settings.gecko.id` (an explicit add-on ID).
- `browser_specific_settings.gecko.data_collection_permissions: { required: ['none'] }`. **AMO has
  required this key for new extensions since 2025-11-03** [S16]. `"none"` cannot be combined with
  other values. One Mozilla Discourse report says Firefox 127 and older error on the key, so set a
  `strict_min_version` of at least 140 (unverified, open question Q3).
- In Firefox MV3, the host permissions in `host_permissions` and the `content_scripts` matches appear
  in the install prompt and have been granted at install since Firefox 127, **but users can revoke
  them** in about:addons [S17]. Static content scripts stop running if they do. Consider a
  `permissions.contains` check.

### Recommended `wxt.config.ts` shape

```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  targetBrowsers: ['chrome', 'firefox'],
  manifestVersion: 3, // Firefox would otherwise default to MV2 [S6][S15]
  manifest: ({ browser }) => ({
    name: 'GH ListRollup',
    permissions: ['storage'],
    host_permissions: ['https://github.com/*'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'gh-listrollup@<owner-domain>', // placeholder
          strict_min_version: '140.0',            // see Q3
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
  webExt: { startUrls: ['https://github.com/wxt-dev/wxt'] },
  zip: { /* includeSources / excludeSources: see the zip section */ },
});
```

Notes. In 0.21.5 the option that turns off the auto-launched browser is `webExt: { disabled: true }`
[S15]. The v0.21 upgrade text mentions `webExt.enabled: false` [S7], but the type definitions only
have `disabled`. The `runner` key was renamed `webExt` and the old name was removed in v0.21 [S7].

## Content scripts

```ts
export default defineContentScript({
  matches: ['https://github.com/*'],
  runAt: 'document_idle', // the default [S2]; document_start/document_end are also allowed
  main(ctx) { /* ... */ },
});
```

- Options include `matches`, `excludeMatches`, `runAt` (default `document_idle`, values can be set
  per browser), `world` (`'ISOLATED'` by default, `'MAIN'` is MV3-only and has no extension API
  access), `cssInjectionMode` (`'manifest'` | `'manual'` | `'ui'`), `registration` and `allFrames`
  [S2][S13]. Stay in the isolated world. Nothing in this project needs page JavaScript.
- **`ctx` (ContentScriptContext)** [S3]. Browsers do not stop old content scripts when the extension
  is updated, reloaded or disabled. `ctx` detects that ("invalidation") and exposes `ctx.isValid`,
  `ctx.isInvalid`, `ctx.signal` (an `AbortSignal`), `ctx.onInvalidated(cb)` (returns an
  unsubscribe), and wrapped `setTimeout`, `setInterval`, `requestAnimationFrame` and
  `requestIdleCallback` that cancel themselves. `ctx.addEventListener(target, type, handler)` removes
  its listener on invalidation [S3]. Pass `ctx.signal` to `fetch`, to `MutationObserver` teardown,
  and to `delegate-it`/`element-ready` calls. Then a reloaded dev build, or an updated extension, does
  not leave duplicate toggles on the page.
- **`wxt:locationchange`.** "Triggered when HTML5 history mode is used to change URL. Content scripts
  are not reloaded when navigating this way" [S3]. Subscribe through
  `ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl, oldUrl }) => ...)` [S2]. The
  watcher starts lazily on first use. Its source [S4] **uses the Navigation API `navigate` event when
  `globalThis.navigation` exists, and otherwise polls `location.href` every 1 s** through
  `ctx.setInterval`. Consequences for GitHub:
  - `navigate` fires at the **start** of a navigation, before GitHub (Turbo/React) has rendered the
    new DOM. The event alone cannot be the trigger for re-applying DOM changes. Re-scan when the
    listing element appears: an element-ready, MutationObserver or Refined-GitHub-style
    animation-start observer, or GitHub's own `turbo:render` / `soft-nav:react-done` document
    events. See prior-art.md.
  - Firefox: Mozilla planned to enable the Navigation API in Firefox 147 [S18]. Whether
    `globalThis.navigation` is reachable from an isolated-world content script through Xrays is
    **unverified**. Firefox may therefore fall back to the 1 s poll (open question Q4).
- The `matches` pattern must cover every page the script may soft-navigate into [S2], so match
  `https://github.com/*` and gate the logic with URL detection (`github-url-detection` or a
  `MatchPattern` from `#imports`).

### UI helpers

- `createIntegratedUi(ctx, { position: 'inline', anchor, append, onMount })` injects next to page
  content and inherits page CSS, so it can use GitHub's Primer classes and CSS variables [S2]. It
  fits a toggle chevron in the listing header and indented child rows, which have to look native.
  `ui.autoMount()` watches the anchor and mounts or unmounts as the anchor appears and disappears.
  That is useful under soft navigation, and `ui.remove()` stops it.
- `createShadowRootUi` isolates styles, and v0.21 dropped the inner `<html>` wrapper [S7]. Use it for
  any options or popover UI. It is a poor fit for rows inside GitHub's table.
- `createIframeUi` gives full isolation but needs `web_accessible_resources` [S2]. Not needed here.
- `anchor` accepts a selector, an XPath, an element, or a function. `append` accepts
  `last`/`first`/`replace`/`before`/`after` or a custom function [S2].

## Storage

`import { storage } from '#imports'` (it resolves to `wxt/utils/storage`, backed by
`@wxt-dev/storage`) [S12][S13]. Keys carry an area prefix (`local:`, `sync:`, `session:`,
`managed:`).

```ts
export const listingCollapsedDefault = storage.defineItem<boolean>('sync:listingCollapsedDefault', {
  fallback: true,
});
// await listingCollapsedDefault.getValue(); listingCollapsedDefault.watch(v => ...)
```

`defineItem` also supports `version` and `migrations`, and v0.21.5 added metadata watchers [S14]. The
project needs the `storage` permission for this.

## The `browser` global and the polyfill

Since v0.20 WXT's `browser` (from `wxt/browser` or `#imports`) no longer uses `webextension-polyfill`
[S7]. It is backed by `@wxt-dev/browser`, and its types come from `@types/chrome` through the
`Browser` namespace (`Browser.runtime.MessageSender`). Behavioral difference: an
`onMessage` listener can no longer return a promise. Use `sendResponse` and `return true` [S7]. The
polyfill can be added back with `@wxt-dev/webextension-polyfill`. This project does not need it.

## Imports

`#imports` is a virtual module that re-exports every WXT API, for example `defineContentScript`,
`ContentScriptContext`, `MatchPattern`, `createIntegratedUi`, `storage` and `browser`. The bundler
rewrites it into per-subpath imports such as `wxt/utils/define-content-script` [S13]. Auto-imports
are on by default, but explicit `#imports` reads better and works with auto-imports turned off.

## Testing hooks

`vitest.config.ts` uses `plugins: [WxtVitest()]` from `wxt/testing/vitest-plugin` [S11]. The plugin
polyfills `browser` with the in-memory `@webext-core/fake-browser`, applies the Vite config and
plugins from `wxt.config.ts`, sets up auto-imports, defines the `import.meta.env.*` globals, and
configures the `@/` aliases [S11]. Import `fakeBrowser` from **`wxt/testing/fake-browser`**. The
`wxt/testing` barrel was removed in v0.21 [S7], and `fake-browser` v2 types now match
`@wxt-dev/browser` [S7]. Call `fakeBrowser.reset()` in `beforeEach`. To test invalidation, build
`new ContentScriptContext('name')` and call `ctx.notifyInvalidated()` (documented in the source
comments of `content-script-context.ts`). Details are in testing-extensions.md.

## Zip and AMO sources

- `wxt zip` builds the Chrome zip. **`wxt zip -b firefox` builds the extension zip and a sources
  zip**, and since v0.21 it prints every included file [S7][S10].
- v0.21 changed `zip.includeSources` and `zip.excludeSources` into a plain allowlist (included minus
  excluded). Dotfiles are left out unless `zip.dotSources: true` [S7]. Defaults also exclude
  `node_modules`, tests and the output directory [S10].
- AMO reviewers must be able to rebuild byte-identical output. Ship a `README.md` or
  `SOURCE_CODE_REVIEW.md` with the exact commands (`pnpm i && pnpm zip:firefox`), and check that
  output from the extracted zip matches output from the repository [S10]. `.env` files change chunk
  hashes [S10]. This project should have none.
- Zip filename template: since v0.21 `{{version}}` means `manifest.version`, and `{{packageVersion}}`
  and `{{modeSuffix}}` are new [S7].
- `wxt submit` supports the Chrome Web Store v2 API through a service account. The CWS v1 API stopped
  working on 2026-10-15 [S7].

## Node and package-manager recommendation

- Node floor: `wxt >=22` [S1][S7], `web-ext@10 >=22`, `vitest@5 ^22.12 || ^24 || >=26`, and
  `github-url-detection >=22.18` [S1]. **Use Node 26 LTS** (26.13.x, LTS since 2026-10-28 [S19]). Pin
  it with `.nvmrc`/`.node-version` and `"engines": { "node": ">=22.18" }`.
- pnpm 12.21.0 is current [S1]. WXT treats all managers equally [S9]. pnpm is a reasonable default
  and appears first in the publishing docs' rebuild example [S10]. Pin it with the
  `packageManager` field.

## Unverified claims

- U1: AMO accepts `data_collection_permissions` with `strict_min_version: '140.0'` without warnings.
  Sources conflict on how older Firefox versions treat the key [S16].
- U2: The Navigation API is reachable from Firefox isolated-world content scripts. If it is not, WXT
  falls back to 1 s polling [S4][S18].
- U3: `vite@8` works with `wxt@0.21.5` and `vitest@5.1.0` together. The peer ranges allow it [S1],
  but it has not been tested.

## Open questions

- Q1: Pin TypeScript 6.0.3 for typescript-eslint compatibility, or adopt TS 7 and drop typed lint
  rules? Recommendation: 6.0.3.
- Q2: Should the build add a `permissions.contains` onboarding check in case a Firefox user revokes
  github.com access [S17]? That would need an options or background entrypoint.
- Q3: What is the exact `strict_min_version` for Firefox (140, the data-consent era, versus 127, host
  permissions granted at install)?
- Q4: Use `wxt:locationchange` and a DOM-ready re-scan, or skip it and rely only on GitHub's
  `turbo:render` / `soft-nav:*` events plus an element observer, as Refined GitHub does?
- Q5: The add-on ID format and owner domain for `gecko.id`.
