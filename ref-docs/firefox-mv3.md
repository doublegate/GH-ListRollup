# Firefox Manifest V3: Platform Reference for GH-ListRollup

Retrieved: 2026-11-15

Scope: Firefox-specific manifest keys, the background model, the host-permission granting model,
the `browser.*` APIs, the mandatory `data_collection_permissions` key, and Firefox for Android.
Findings are paraphrased from primary docs; quotes are kept short.

## Sources

- [S1] https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings : MDN `browser_specific_settings` (gecko id, version bounds, data_collection_permissions, gecko_android).
- [S2] https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/ : Extension Workshop guide to Firefox built-in data collection consent.
- [S3] https://blog.mozilla.org/addons/2025/10/23/data-collection-consent-changes-for-new-firefox-extensions/ : Add-ons blog announcement of the November 3, 2025 requirement.
- [S4] https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background : MDN `background` key (scripts vs service_worker, cross-browser manifest).
- [S5] https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/ : Extension Workshop MV3 migration guide.
- [S6] https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions : MDN `host_permissions` (Firefox 127 install-prompt change).
- [S7] https://blog.mozilla.org/addons/2024/05/14/manifest-v3-updates/ : Add-ons blog, MV3 updates (Firefox 127 install-time host permissions, Firefox 128 Android permissions UI).
- [S8] https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/request : MDN `permissions.request()`.
- [S9] https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts : MDN content scripts (MV3 CORS behavior in Firefox 101+).
- [S10] https://raw.githubusercontent.com/mdn/browser-compat-data/main/webextensions/ (manifest/*.json, api/storage.json) : MDN browser-compat-data, used for exact version numbers.
- [S11] https://discourse.mozilla.org/t/do-older-firefox-versions-ignore-data-collection-permissions/145985 : Mozilla Discourse thread on `data_collection_permissions` and older Firefox (community/staff forum, not normative docs).
- [S12] https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/ExecutionWorld : MDN `scripting.ExecutionWorld` (ISOLATED vs MAIN).
- [S13] https://extensionworkshop.com/documentation/publish/add-on-policies/ : Current AMO Add-on Policies (data transmission definition).

## 1. `browser_specific_settings.gecko`

- **`id`**: required for MV3. "Mandatory for signing extensions", whether listed on AMO or
  self-distributed. For MV3, "AMO does not assign an ID" [S1]. Use an email-like string (80
  characters or fewer, matching `^[a-zA-Z0-9-._]*@[a-zA-Z0-9-._]+$`) or a braced GUID [S1]. The ID
  is permanent once the first version is signed, so choose it before first submission. A suggested
  form is `gh-listrollup@<owned-domain-or-handle>`.
- **`strict_min_version`**: the minimum Gecko version; `*` is not valid [S1]. MDN notes the oldest
  version that can still receive updates is 115.0 (ESR), or 128.0 if ESR is excluded [S1].
- **`strict_max_version`**: defaults to `*`. Most extensions omit it [S1].
- **`update_url`**: only for self-hosted updates (must be `https`). Not used for AMO-listed
  extensions [S1].
- **`gecko_android`**: supports `strict_min_version` and `strict_max_version` (Firefox for Android
  113+) [S1][S10]. To support Android without a version range it "must be an empty object". Per
  MDN, if this sub-key is absent the extension "is only made available on desktop Firefox" [S1].

## 2. `data_collection_permissions` (mandatory for new AMO submissions)

Shape [S1][S2]:

```json
"browser_specific_settings": {
  "gecko": {
    "data_collection_permissions": {
      "required": ["none"]
    }
  }
}
```

- `required` "must contain the value `none`, or one or more of" the data types below [S1].
  `optional` can contain data types (including `technicalAndInteraction`, which may only be
  optional) but not `none` [S1][S2].
- Data types: `authenticationInfo`, `bookmarksInfo`, `browsingActivity`,
  `financialAndPaymentInfo`, `healthInfo`, `locationInfo`, `personalCommunications`,
  `personallyIdentifyingInfo`, `searchTerms`, `websiteActivity`, `websiteContent`, plus
  `technicalAndInteraction` (optional only) [S1][S2].
- "If your extension doesn't collect or transmit any data, you indicate that by specifying the
  `none` required permission" [S2].
- **Dates:** "From November 3, 2025, all new extensions must adopt" the system [S2]. Existing
  extensions are exempt for now. Mozilla said that "in the first half of 2026" it would require all
  extensions to adopt it, with notice on the add-ons blog [S3]. I could not confirm whether that
  all-extensions deadline has since been set or enforced. GH-ListRollup is a new extension, so
  the key is required regardless.
- Once a version uses the key, every later version must keep it [S3]. Submissions that need it and
  lack it "will be blocked from signing" [S3].
- **Firefox support:** desktop 140+, Android 142+ [S2][S10]. Versions before that do not show the
  built-in consent UI. The AMO policy then requires an in-extension consent flow for any data
  collected [S3]. With `none`, there is nothing to consent to.
- **Older-Firefox caveat (forum, not normative):** a Mozilla Discourse thread reports that
  "Firefox 127 and below will error if `data_collection_permissions` field is present", and
  recommends `strict_min_version` of at least `128.0` [S11]. Extension Workshop separately suggests
  140 (desktop) and 142 (Android) as one way to require the built-in experience [S2].

### Which value applies to this project?

The AMO policy defines data transmission as data "collected, used, transferred, shared, or handled"
"outside of the add-on or the local browser" [S13]. GH-ListRollup:

- sends no data to the developer or to any third party;
- reads page content locally to transform the DOM;
- optionally sends the user's own token, which the user entered, to `api.github.com`, the service
  the user is already using, to authenticate API calls the user's browsing triggers.

The policy text I retrieved does not explicitly exempt the third case. Arguably the token reaches
"outside of the add-on" and is `authenticationInfo` [S2]. Precedent: Refined GitHub, which also
accepts a user-supplied GitHub token and calls `api.github.com`, currently ships
`"data_collection_permissions": {"required": ["none"]}` in its public manifest (observed
2026-11-15). **Recommendation:** declare `"required": ["none"]`, and state plainly in the AMO
listing and privacy notes that an optional token is stored locally and sent only to
`api.github.com`. Treat this as an open question to confirm with an AMO reviewer, or in the
submission's reviewer notes, on first submission. The alternative is `"optional":
["authenticationInfo"]` with `"required": ["none"]`, requesting consent at runtime via
`permissions.request()` when the user saves a token [S2][S8]. That is the conservative choice if a
reviewer objects.

## 3. Background: event page, not service worker

- `background.service_worker` is **not supported** in Firefox (bug 1573659) [S4][S10].
- Firefox MV3 uses `background.scripts`, a non-persistent event page. `persistent` defaults to
  `false` in MV3, and "Setting to `true` in Manifest V3 results in an error" [S4].
- Listeners persist across unloads, but in-memory values do not, so use storage [S4].
- A manifest may contain both `scripts` and `service_worker`. Firefox uses `scripts`, and Chrome
  121+ uses `service_worker` and ignores `scripts` [S4]. From Firefox 121 the background page starts
  even when `service_worker` is present [S4].
- `background.preferred_environment` exists in Firefox 136+ and Chrome ignores it. It is not needed
  for the fallback [S4][S10].

Because the Firefox background is a document (event page), it has DOM APIs and no 30-second
service-worker kill rule. It can still be unloaded when idle. Write background code that works
under the stricter Chrome service-worker model and it will work in both.

## 4. Host permission granting model

- **Firefox 126 and earlier:** MV3 host permissions were not granted at install [S6].
- **Firefox 127+:** "host permissions listed in `host_permissions` and `content_scripts` are
  displayed in the install prompt" and granted at install [S6][S7]. Host permissions added in a
  later update are not shown to the user (bug 1893232) [S6]. Adding a host in an update can
  therefore leave it ungranted, and the extension must detect that and request it.
- Users "can grant or revoke host permissions on an ad hoc basis", so most browsers treat
  `host_permissions` as optional [S6]. "MV3 host permissions can still be revoked by the user at
  any time from the about:addons page on Firefox Desktop" [S7].
- **Firefox for Android 128+:** the Add-ons Manager gained a permissions UI for host permissions
  and optional permissions [S7].
- **How to prompt:** call `browser.permissions.contains({origins})` after install and on options
  page load. If it returns false, show a button whose click handler calls
  `browser.permissions.request({origins})`. The request is only allowed "inside the handler for a
  user action" [S6][S8]. All-or-nothing semantics; granted permissions survive upgrades and
  disable/enable [S8].
- `optional_host_permissions` is supported from Firefox 128 [S10].

Project handling: with `strict_min_version` of 128 or higher, install-time granting (127+) applies.
Still implement a "permission missing" state (an onboarding or options-page notice with a Grant
button), because users can revoke access.

## 5. Content scripts and fetch in Firefox MV3

- Firefox supports `world: "MAIN"` in manifest content scripts from Firefox 128 [S10]. MDN warns
  the page "can detect and interfere with the executed code" in `MAIN` [S12]. This project uses
  the default isolated world.
- `match_origin_as_fallback` is supported from Firefox 128 [S10] (not needed).
- At `document_start`, Firefox does not inject into empty iframes even when asked [S10] (irrelevant
  here, since `all_frames` is false).
- **CORS:** "In Chrome, starting with version 73, and Firefox, starting with version 101 when using
  Manifest V3, content scripts are subject to the same CORS policy as the page they are running
  within. Only backend scripts have elevated cross-domain privileges" [S9]. In MV3 content-script
  requests run in the page context, so relative URLs resolve against the page. The MV2-only
  `content.fetch()` is not available [S9]. This matches Chrome, so the same architecture works in
  both: same-origin `github.com` fetches in the content script, `api.github.com` calls in the
  background with `host_permissions`.
- In MV3, content scripts are "subject to the same CSP as other parts of the extension" [S5].

## 6. `browser.*` promise APIs and storage

- Firefox has always exposed the promise-based `browser.*` namespace. Firefox MV3 also supports
  promises on `chrome.*` [S5].
- `browser.storage.local` and `sync` work in content scripts (Firefox 48+) [S10].
- `storage.session` exists from Firefox 115 [S10]. **Unverified:** whether Firefox exposes
  `storage.session` to content scripts. Firefox does **not** implement
  `StorageArea.setAccessLevel()` [S10], so the Chrome hardening step of hiding `local` from content
  scripts is unavailable. Mitigation: keep all token reads in the background script and never
  forward the token to the content script.
- On Firefox for Android, `storage.sync` data "isn't synchronized with the user's Mozilla account"
  and quotas are not enforced (bug 1625257) [S10]. Settings stored in `sync` therefore behave like
  `local` on Android.

## 7. Firefox for Android

- Declare `"gecko_android": {}` (or a version range) or the listing is desktop-only [S1].
- `data_collection_permissions` needs Android 142+ for the built-in UI [S2][S10]. Set
  `gecko_android.strict_min_version` accordingly if a uniform experience is wanted.
- Host-permission management UI exists from Android 128 [S7].
- Product risk, not a platform rule: github.com on a phone may serve a different, narrower layout
  for the code view. The rollup DOM selectors must be tested on Android or Android support deferred
  to a later release. Not verified in this research.

## 8. WXT-specific Firefox notes

- WXT targets **MV2 for Firefox by default** ("By default, WXT will target MV2 for Safari and
  Firefox and MV3 for all other browsers"). Build with `wxt build -b firefox --mv3` (or the WXT
  equivalent config) to get an MV3 Firefox build. See `cross-browser-differences.md`.
- WXT's API reference includes a `FirefoxDataCollectionPermissions` type, which indicates the key is
  modeled in its manifest types. Exact placement in `wxt.config.ts` is not confirmed here; set it
  explicitly under `browser_specific_settings.gecko` in the manifest function when
  `browser === 'firefox'`.

## 9. Manifest snippet (Firefox build, as WXT should emit it)

```json
{
  "manifest_version": 3,
  "name": "GH-ListRollup",
  "version": "0.1.0",
  "description": "Collapse GitHub repository file listings and expand folders inline.",
  "browser_specific_settings": {
    "gecko": {
      "id": "gh-listrollup@example.invalid",
      "strict_min_version": "140.0",
      "data_collection_permissions": {
        "required": ["none"]
      }
    },
    "gecko_android": {
      "strict_min_version": "142.0"
    }
  },
  "permissions": ["storage"],
  "host_permissions": [
    "https://github.com/*",
    "https://api.github.com/*"
  ],
  "background": {
    "scripts": ["background.js"]
  },
  "content_scripts": [
    {
      "matches": ["https://github.com/*"],
      "js": ["content-scripts/content.js"],
      "css": ["content-scripts/content.css"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": { "page": "options.html" },
  "icons": { "48": "icon/48.png", "96": "icon/96.png" }
}
```

Replace `example.invalid` with a domain or handle the project controls before first signing. 140 /
142 are chosen so the built-in consent UI is always available and the older-Firefox error is
avoided. 128 is the lowest defensible floor [S11]. Leave out `gecko_android` if Android is out of
scope for v1.

## Unverified claims

- Whether a user-supplied token sent only to `api.github.com` counts as `authenticationInfo`
  transmission under AMO policy (section 2). Precedent suggests `none` is accepted.
- Whether the "first half of 2026" requirement for all existing extensions has been enforced.
- Whether Firefox exposes `storage.session` to content scripts.
- Whether github.com's mobile layout on Firefox for Android uses the same code-view DOM.
- The Firefox 127-and-below error with `data_collection_permissions` comes from a forum post
  [S11], not normative documentation.

## Open questions

1. Final gecko `id` string (permanent after first signing).
2. `strict_min_version`: 128 (wider reach, needs custom handling of the missing built-in consent UI
   on 128-139; with `none` that is likely a no-op) or 140 (simplest)?
3. Ship Android in v1 or desktop only?
4. `required: ["none"]` alone, or also `optional: ["authenticationInfo"]` requested when a token is
   saved?
