# Cross-Browser Differences (Chrome vs Firefox) for GH-ListRollup

Retrieved: 2026-11-15

Scope: the Chrome/Firefox differences that affect this project's manifest, background code,
storage, messaging and build, and whether `webextension-polyfill` is still needed under WXT.
Details and per-browser citations are in `chrome-mv3.md` and `firefox-mv3.md`. This file
summarizes and adds the WXT angle.

## Sources

- [S1] https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background : MDN background key, cross-browser `scripts` + `service_worker` manifest.
- [S2] https://developer.chrome.com/docs/extensions/develop/concepts/browser-namespace : Chrome `browser` namespace and promise `onMessage` (Chrome 148).
- [S3] https://wxt.dev/guide/essentials/extension-apis.html : WXT extension APIs (`browser` global, polyfill opt-in, feature detection).
- [S4] https://wxt.dev/guide/resources/upgrading.html : WXT upgrade guide (v0.20 removes webextension-polyfill).
- [S5] https://wxt.dev/guide/essentials/target-different-browsers.html : WXT per-browser targeting (default MV2 for Firefox).
- [S6] https://wxt.dev/guide/essentials/config/manifest.html : WXT manifest generation (function of browser/manifestVersion).
- [S7] https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts : MDN content scripts, MV3 CORS parity.
- [S8] https://raw.githubusercontent.com/mdn/browser-compat-data/main/webextensions/ : MDN browser-compat-data (versions for `world`, `setAccessLevel`, `service_worker`, etc.).
- [S9] https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions : MDN host_permissions (Firefox install-prompt behavior).
- [S10] https://developer.chrome.com/docs/extensions/reference/api/permissions : Chrome permissions API (withheld permissions, user gesture).
- [S11] https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings : MDN browser_specific_settings.

## 1. Difference table

| Area | Chrome (MV3) | Firefox (MV3) | Project handling |
|---|---|---|---|
| Background | `background.service_worker` only; 30 s idle kill, no DOM [S1] | `background.scripts` event page; `service_worker` unsupported [S1][S8] | WXT emits the right key per target. Write stateless, top-level-listener background code. |
| Combined manifest | Chrome 121+ ignores `scripts`; earlier refuses to load [S1] | Firefox 121+ starts the page even if `service_worker` is present [S1] | Not needed: WXT builds per browser. |
| Extension ID | Assigned by Chrome Web Store from the signing key | `browser_specific_settings.gecko.id` mandatory for MV3 [S11] | Set `gecko.id` only in the Firefox manifest. |
| Data disclosure in manifest | none (disclosed in CWS dashboard) | `gecko.data_collection_permissions` required for new AMO extensions [S11] | Firefox-only key: `{"required": ["none"]}`. |
| Host permission grant | Granted at install; users can withhold via site access; `permissions.request()` can re-request [S10] | Granted at install from 127; revocable in about:addons; new hosts in updates not prompted [S9] | Same code path: `permissions.contains()` check plus a user-gesture Grant button. |
| `optional_host_permissions` | 102+ | 128+ [S8] | Unused in v1. |
| Content-script `world` key | 111+ | 128+ [S8] | Use default ISOLATED in both. |
| Content-script CORS | Page origin (since 73) [S7] | Page origin in MV3 (since 101) [S7] | Same: same-origin `github.com` in content script, `api.github.com` via background. |
| `storage.session` | 102+, 10 MB, hidden from content scripts by default | 115+ [S8] | Optional "session-only token" mode works in both. |
| `StorageArea.setAccessLevel` | `session` 96+, all areas 140+ [S8] | Not implemented [S8] | Feature-detect. Never pass the token to the content script, so neither browser depends on it. |
| `storage.sync` on mobile | n/a (no Chrome Android extensions) | Not synced, quota not enforced on Android [S8] | Treat `sync` as best-effort. |
| `browser` namespace | Alias of `chrome` from 148 [S2] | Native | Use WXT's `browser` import (works on older Chrome too). |
| Promise-returning `runtime.onMessage` listener | 148+ [S2] | Supported (Firefox native `browser`) | Do not rely on it (see section 2). |
| Android | No extension support in Chrome for Android | Supported; needs `gecko_android` [S11] | Firefox-only consideration. |

## 2. Is `webextension-polyfill` still needed with WXT?

**No, not by default, and it is not recommended for this project.**

- WXT v0.20 removed it: "WXT's `browser` no longer uses the `webextension-polyfill`!" [S4].
  `browser` now comes from `@wxt-dev/browser` and is typed from `@types/chrome` [S4].
- At runtime WXT's `browser` uses the native `browser` global if it has `runtime.id`, and otherwise
  falls back to `chrome`. This gives promise-style calls on MV3 in Chromium and Firefox [S3].
- The one behavioral gap without the polyfill: "`browser.runtime.onMessage` no longer supports
  using promises to return a response". Use `sendResponse` and `return true` instead [S4]. Chrome
  148 added native promise-returning listeners [S2], but users on older Chrome would break, so keep
  the `sendResponse` pattern (or a typed messaging helper that implements it) until the minimum
  Chrome version is at least 148.
- The polyfill is available as an opt-in through `@wxt-dev/webextension-polyfill` [S3][S4], and it
  becomes a no-op on Chrome 148+ anyway [S2]. Adding it would cost bundle size and AMO review
  surface for no gain.
- Type caveat: WXT's types follow `@types/chrome`, so Firefox-only APIs are missing from types [S3].
  This project uses no Firefox-only APIs.
- Do not call `browser.*` at module top level in entrypoints. WXT imports entrypoints in Node with
  a fake browser during the build; call them inside `main()` [S3].

## 3. WXT build matrix

- WXT targets "MV2 for Safari and Firefox and MV3 for all other browsers" by default. Use the
  `--mv3` flag (or the equivalent config) for Firefox [S5]. The project decision is MV3 for both,
  so the Firefox scripts must be `wxt build -b firefox --mv3` and `wxt zip -b firefox --mv3`.
- The manifest can be a function of `{browser, manifestVersion, mode, command}` [S6]. Put
  `browser_specific_settings` (gecko id, `strict_min_version`, `data_collection_permissions`,
  `gecko_android`) inside a `browser === 'firefox'` branch, and `minimum_chrome_version` inside the
  Chrome branch.
- "You are responsible for passing only the permissions required for each browser" [S6]. With
  identical permissions (`storage` plus the two GitHub hosts), the lists can be shared.
- Runtime branching, if ever needed: `import.meta.env.BROWSER === 'firefox'` or
  `import.meta.env.FIREFOX` [S5].
- Edge and other Chromium browsers use the Chrome MV3 build unchanged (`-b edge` produces the same
  shape).

## 4. Practical guidance

1. Write background code to the strictest model (Chrome service worker): register listeners
   synchronously at top level, keep no state in globals, and use no DOM in the background.
2. Keep the token flow identical in both browsers: the options page writes the token to
   `storage.local`; only the background reads it; the content script sends
   `{owner, repo, ref, path}` messages and receives listing data. This avoids depending on
   `setAccessLevel`, which Firefox lacks.
3. Implement one "missing host permission" UX for both browsers, using `permissions.contains` and
   `permissions.request` from a click handler.
4. Test both builds against the same DOM fixtures. Content-script behavior is the same engine
   contract (isolated world, page-origin CORS) in both.

## Unverified claims

- Exact WXT config key for selecting MV3 per browser in `wxt.config.ts` (the docs I read document
  only the CLI flags). Check `wxt.config.ts` options (`manifestVersion`) against the installed WXT
  version during bootstrap.
- Whether WXT auto-injects any Firefox `browser_specific_settings` (for example a gecko id) when
  none is configured. Assume it does not.

## Open questions

1. Minimum Chrome 148 (native `browser` and promise `onMessage`) or a lower floor with
   `sendResponse`? The recommendation is the lower floor.
2. Use a messaging helper library (for example `@webext-core/messaging`, which the WXT ecosystem
   uses) or hand-written typed messages? A dependency adds AMO review surface.
