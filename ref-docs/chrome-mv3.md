# Chrome Manifest V3: Platform Reference for GH-ListRollup

Retrieved: 2026-11-15

Scope: the Chrome (and Chromium) extension platform features this project depends on: content
scripts, the background service worker, `chrome.storage`, host permissions, network requests from
each context, extension CSP, and minimum Chrome version. Findings are paraphrased from primary docs;
quotes are kept short.

## Sources

- [S1] https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts : Content scripts concept guide (isolated worlds, injection, security notes).
- [S2] https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts : `content_scripts` manifest key reference (all sub-keys and defaults).
- [S3] https://developer.chrome.com/docs/extensions/reference/api/scripting : `chrome.scripting` API reference (dynamic registration, `RegisteredContentScript`).
- [S4] https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle : Extension service worker lifecycle and termination rules.
- [S5] https://developer.chrome.com/docs/extensions/reference/api/storage : `chrome.storage` API reference (areas, quotas, access levels).
- [S6] https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions : Declaring permissions, host permissions and optional host permissions.
- [S7] https://developer.chrome.com/docs/extensions/reference/api/permissions : `chrome.permissions` API (runtime requests, user gesture, withheld permissions).
- [S8] https://developer.chrome.com/docs/extensions/develop/concepts/network-requests : Cross-origin network requests from extension contexts and content scripts.
- [S9] https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy : MV3 `content_security_policy` key.
- [S10] https://developer.chrome.com/docs/extensions/develop/concepts/browser-namespace : Chrome's `browser` namespace (Chrome 148).
- [S11] https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests : GitHub REST API CORS support.
- [S12] https://raw.githubusercontent.com/mdn/browser-compat-data/main/webextensions/ (manifest/content_scripts.json, manifest/background.json, api/storage.json) : MDN browser-compat-data, used for exact version numbers.
- [S13] https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background : MDN `background` key (Chrome 121 behavior with `background.scripts`).

## 1. Content scripts

### Manifest declaration

Each `content_scripts` entry requires `matches` plus `js` and/or `css` [S2]. Relevant keys and
defaults [S2]:

| Key | Default | Notes for this project |
|---|---|---|
| `matches` | required | `https://github.com/*`. Path filtering to repo pages happens in code, because GitHub is a single-page app (see below). |
| `exclude_matches` | none | Optional; could exclude obviously irrelevant paths, but SPA navigation makes this unreliable. |
| `run_at` | `document_idle` | `document_start`, `document_end`, `document_idle`. Chrome calls `document_idle` "the preferred and default value" [S1]. |
| `all_frames` | `false` | Keep `false`: the file listing is in the top frame. |
| `world` | `ISOLATED` | `MAIN` shares the page's JS globals; Chrome warns "There are risks involved when using the `MAIN` world" [S2]. Manifest `world` is Chrome 111+ [S12]. |
| `match_about_blank`, `match_origin_as_fallback` | `false` | Not needed. |

Isolated world: the content script shares the DOM with the page but has its own JavaScript globals
[S1]. When a script runs in `MAIN`, "the CSP of the page applies" [S1]. This project needs only DOM
access, so `ISOLATED` is correct. It also keeps any token handling out of reach of page scripts.

Content scripts run only on page loads and full navigations. GitHub uses client-side (Turbo/React)
navigation between repo pages, so the script must watch for in-page route changes (for example
DOM mutation observation or GitHub's navigation events). This is an inference from how
`matches` works [S2], not something the Chrome docs state about GitHub. The DOM-integration research
should confirm it.

Content scripts can call only a small set of extension APIs directly (including `storage` and
`runtime` messaging). Everything else goes through message passing [S1].

### Dynamic registration

`chrome.scripting.registerContentScripts()` (Chrome 96+) registers scripts at runtime. `world` in
registered scripts is Chrome 102+. `persistAcrossSessions` defaults to `true` [S3]. It needs the
`scripting` permission plus host permissions for the target pages [S3]. **Not needed for v1:** a
static `content_scripts` entry for `https://github.com/*` is simpler. Dynamic registration only
matters for a future GitHub Enterprise Server option, where the user grants an arbitrary host at
runtime and the extension then registers a script for it.

## 2. Background service worker lifecycle

- Chrome terminates the worker "after 30 seconds of inactivity". Events and extension API calls
  reset the timer [S4].
- A single event or API call running longer than 5 minutes causes termination. A `fetch()` whose
  response takes more than 30 seconds to arrive also ends the worker [S4].
- Since Chrome 110, extension API calls reset the idle timers. Since Chrome 114, sending a message
  on a long-lived port keeps the worker alive [S4].
- "Any global variables you set will be lost if the service worker shuts down." Persist state in
  `chrome.storage`, IndexedDB, or CacheStorage. Web Storage (`localStorage`) is not available in
  extension service workers [S4].

Implication: any per-page cache of fetched folder contents belongs in the content script's memory
(it lives as long as the tab), not in the worker. If the worker proxies API calls, it must register
listeners synchronously at top level and must not hold state in globals.

## 3. `chrome.storage`

| Area | Quota | Persistence | Exposed to content scripts by default |
|---|---|---|---|
| `local` | 10 MB (5 MB in Chrome 113 and earlier) | Until the extension is removed | Yes [S5] |
| `sync` | about 100 KB total, 8 KB per item, 512 items, 120 writes/min, 1800 writes/hour | Synced across the user's signed-in Chrome instances | Yes [S5] |
| `session` | 10 MB (1 MB in Chrome 111 and earlier) | In memory only, "will not be persisted to disk"; cleared on reload, update, disable, or browser restart | No [S5] |
| `managed` | n/a | Read-only, set by enterprise policy | Yes [S5] |

- `setAccessLevel()` can change which contexts see an area. MDN compat data says it supports
  `session` from Chrome 96 and all storage areas from Chrome 140 [S12].
- For sensitive data Chrome advises: "If you're working with sensitive user data, instead use
  `storage.session`" [S5].
- **Not stated in the current Chrome reference:** the reference I retrieved does not say whether
  `storage.local` is encrypted at rest. Older docs said it is not encrypted, but treat that as
  unverified for 2026. Assume a token in `storage.local` is stored in plain text in the browser
  profile.

Project choice:

- Preferences (default collapsed/expanded state, etc.) go in `storage.sync`, which is small and
  synced. Use `storage.local` instead if the user should not have settings synced.
- The optional GitHub token goes in `storage.local`, never `sync`, so it does not leave the device
  through browser sync. Optionally restrict access with
  `chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'})` (Chrome 140+ for
  `local` [S12]). Content scripts then cannot read the token, and only the background/options pages
  use it. Firefox does not implement `setAccessLevel` (see `firefox-mv3.md`), so this is a
  Chrome-only hardening step and must be feature-detected.
- `storage.session` offers "remember for this browser session only", at the cost of re-entry after
  every restart. It could be an opt-in mode.

## 4. Host permissions and optional host permissions

- `host_permissions` holds match patterns granted at install. Adding or changing patterns in
  `host_permissions` or `content_scripts.matches` triggers a warning [S6].
- `optional_host_permissions` lists hosts that are "granted by the user at runtime, instead of at
  install time" (Chrome 102+) [S6][S12].
- `chrome.permissions.request()` must be called "from inside a user gesture, like a button's click
  handler" [S7]. It can also re-request required permissions "that were withheld by the user". This
  confirms users can withhold even required host permissions through Chrome's site-access controls
  [S7]. `permissions.onAdded` and `permissions.onRemoved` report changes [S7].

Project choice:

- `host_permissions`: `https://github.com/*` (needed for the content script, and shown at install
  anyway because of `content_scripts.matches`). Also `https://api.github.com/*` if API calls run in
  the background worker (see section 5).
- `optional_host_permissions`: empty for v1. A future GitHub Enterprise Server feature would add
  `https://*/*` here and request specific origins from an options-page button [S7].
- Handle the withheld case: if the user restricted site access, the content script simply does not
  run, and the options page can call `permissions.contains()` and offer a grant button.

## 5. Where network requests can run (CORS)

- Extension pages and the service worker "can talk to remote servers outside of its origin, as
  long as the extension requests host permissions" [S8]. Access is per host and per scheme [S8].
- Content scripts run in the page's origin and "are also subject to the same origin policy".
  "Cross-origin requests are always treated as such in content scripts, even if the extension has
  host permissions" [S8].
- GitHub's REST API "supports cross-origin resource sharing (CORS) for AJAX requests from any
  origin", with `Access-Control-Allow-Origin: *` and exposed headers including `ETag`, `Link` and the
  `x-ratelimit-*` headers [S11].
- Chrome's security guidance: do not let content scripts ask the background to fetch arbitrary
  URLs. Instead "design message handlers that limit the resources that can be fetched", with the
  background building the URL from narrow inputs [S8].

Consequences for this project:

1. **Same-origin `github.com` requests from the content script** (for example the endpoints the
   GitHub web UI itself uses to list a folder) are same-origin for the content script. They carry
   the user's GitHub session cookies, so private repositories the user can already see work
   without a token. Which endpoints exist and are stable belongs to the GitHub-side research.
2. **`api.github.com` requests** could technically run from the content script, because GitHub's
   API sends `Access-Control-Allow-Origin: *` [S11]. Running them in the background worker is
   preferable when a token is attached:
   - the token never has to be readable by the content script;
   - the message handler can accept only `{owner, repo, ref, path}` and build the URL itself, as
     [S8] recommends;
   - this needs `https://api.github.com/*` in `host_permissions`.
3. The background must answer each message well within the 5-minute per-event limit and the
   30-second fetch-response limit [S4]. Listing calls are short, so this is not expected to bind.

Not verified: whether `github.com`'s page CSP (`connect-src`) affects fetches made from an
isolated-world content script in Chrome. Chrome's docs say page CSP applies to the `MAIN` world
[S1], but they do not state the isolated-world case for `fetch`. The background-proxy design avoids
the question for API calls.

## 6. Extension CSP

- `content_security_policy.extension_pages` applies to extension pages and workers. `sandbox`
  applies to sandboxed pages [S9].
- The default allows scripts only from the extension package, blocks inline script and string
  evaluation, and disables WebAssembly [S9].
- The floor is `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';`. It "cannot be relaxed
  beyond this minimum value", so `'unsafe-eval'` or remote script hosts are rejected at install [S9].
- MV3 forbids remotely hosted code. Everything must ship in the package (see `store-publishing.md`).

Project choice: do not declare `content_security_policy` at all; the default is sufficient. WXT's
Vite build emits bundled files with no `eval`. The options page must avoid inline `<script>`.

## 7. Minimum Chrome version

Version-sensitive features this project may touch:

| Feature | Chrome version |
|---|---|
| MV3 `background.service_worker` | 88 [S12] |
| `optional_host_permissions` | 102 [S12] |
| `storage.session` | 102 (1 MB quota before 112 per compat note; the API page says 1 MB in 111 and earlier) [S5][S12] |
| `content_scripts[].world` in manifest | 111 [S12] |
| Manifest containing both `background.scripts` and `background.service_worker` loads (keys ignored) | 121; earlier versions refuse to load it [S13] |
| `storage.*.setAccessLevel` on all areas | 140 [S12] |
| `browser` namespace alias, promise-returning `runtime.onMessage` listeners | 148 [S10] |

Recommendation: set `minimum_chrome_version` to at least `"121"` if the single built manifest
contains both background keys. WXT emits a separate Chrome build, so this is only a concern if
both keys end up in the Chrome manifest. Choosing `"140"` gives `setAccessLevel` on `local` without
feature detection. Refined GitHub, a comparable GitHub-modifying extension, currently ships
`"minimum_chrome_version": "140"` (observed in its public manifest; precedent, not a rule).

## 8. Manifest snippet (Chrome build, as WXT should emit it)

```json
{
  "manifest_version": 3,
  "name": "GH-ListRollup",
  "version": "0.1.0",
  "description": "Collapse GitHub repository file listings and expand folders inline.",
  "minimum_chrome_version": "121",
  "permissions": ["storage"],
  "host_permissions": [
    "https://github.com/*",
    "https://api.github.com/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://github.com/*"],
      "js": ["content-scripts/content.js"],
      "css": ["content-scripts/content.css"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": { "page": "options.html", "open_in_tab": false },
  "icons": { "16": "icon/16.png", "48": "icon/48.png", "128": "icon/128.png" }
}
```

Notes: `world` is omitted (defaults to `ISOLATED`). Do not request `scripting`, `activeTab`,
`tabs`, or `<all_urls>`. Drop `https://api.github.com/*` only if all fetches are same-origin
`github.com` requests from the content script.

## Unverified claims

- Whether `storage.local` is encrypted at rest (current Chrome docs do not say; older docs said it
  is not).
- Whether page CSP `connect-src` constrains isolated-world content-script `fetch` on `github.com`.
- That GitHub's session cookies are not sent on background-worker `fetch` to `github.com`
  (expected because of SameSite cookie rules for a non-github.com top-level site; not tested).

## Open questions

1. Same-origin `github.com` endpoints, or `api.github.com` as the primary folder-listing source?
   This decides whether `https://api.github.com/*` is in `host_permissions` at all.
2. Should the token be stored in `local` with `TRUSTED_CONTEXTS` only (Chrome 140+), or kept
   session-only by default?
3. Exact `minimum_chrome_version`: 121 (floor) or 140/148 (cleaner API surface)?
4. `run_at`: is `document_idle` early enough to avoid a visible flash of the expanded listing
   before collapse? A small `css` injected at `document_start` that hides the listing until the
   script takes over may be needed. Measure.
