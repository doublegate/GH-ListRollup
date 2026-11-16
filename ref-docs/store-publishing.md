# Store Publishing: Chrome Web Store, AMO, Edge Add-ons

Retrieved: 2026-11-15

Scope: what the project must prepare to publish on the Chrome Web Store (CWS) and
addons.mozilla.org (AMO), with Microsoft Edge Add-ons as an optional extra. Covers fees, policies,
dashboard disclosures, review, AMO source-code submission, and `web-ext`.

## Sources

- [S1] https://developer.chrome.com/docs/webstore/register : CWS developer registration (one-time fee).
- [S2] https://blog.chromium.org/2020/03/new-developer-dashboard-and.html : Chromium Blog, 2020, states the $5.00 developer registration fee.
- [S3] https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines : CWS quality guidelines (single purpose).
- [S4] https://developer.chrome.com/docs/webstore/cws-dashboard-privacy : CWS dashboard Privacy practices tab.
- [S5] https://developer.chrome.com/docs/webstore/program-policies/user-data-faq : CWS user data FAQ (local data and auth info count as user data).
- [S6] https://developer.chrome.com/docs/webstore/program-policies/limited-use : CWS Limited Use policy.
- [S7] https://developer.chrome.com/docs/webstore/program-policies/privacy : CWS privacy policy requirement.
- [S8] https://developer.chrome.com/docs/webstore/review-process : CWS review process and timing.
- [S9] https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/ : AMO signing, listed vs unlisted.
- [S10] https://extensionworkshop.com/documentation/publish/source-code-submission/ : AMO source code submission requirements.
- [S11] https://extensionworkshop.com/documentation/publish/add-on-policies/ : Current AMO Add-on Policies.
- [S12] https://extensionworkshop.com/documentation/publish/add-on-policies-preview-2026-12/ : AMO Add-on Policies preview, effective Dec 1, 2026.
- [S13] https://extensionworkshop.com/documentation/develop/web-ext-command-reference/ : `web-ext` command reference (v10).
- [S14] https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/ : Firefox built-in data consent (`data_collection_permissions`).
- [S15] https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension : Publish a Microsoft Edge extension (Partner Center).
- [S16] https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account : Register as a Microsoft Edge extension developer.

## 1. Chrome Web Store

### Registration

- Accept the developer agreement and "pay a one-time registration fee" [S1]. The current
  registration page does not state the amount. The Chromium Blog states "a $5.00 fee" [S2]. Treat
  US$5 as the expected amount, to be confirmed in the dashboard.

### Single purpose

- "An extension must have a single purpose that is narrow and easy to understand" [S3].
  GH-ListRollup fits: one purpose, making GitHub repository file listings collapsible and
  expandable in place. Do not bundle unrelated GitHub tweaks into the same item.
- Suggested single-purpose statement: "Collapses the file listing on GitHub repository pages and
  lets users expand folders inline as a nested tree."

### Privacy practices tab [S4]

The dashboard requires:

1. **Single purpose description.**
2. **Permission justification**, one field per manifest permission. Remove any listed permission
   that is not needed. Draft justifications:
   - `storage`: "Saves the user's display preferences and an optional GitHub token the user
     enters, locally in the browser."
   - `https://github.com/*`: "The content script modifies the file listing on github.com
     repository pages, and fetches folder listings from github.com on behalf of the signed-in
     user."
   - `https://api.github.com/*` (only if used): "Fetches folder contents from the GitHub REST API
     when the user expands a folder."
3. **Remote code declaration:** select "No, I am not using remote code". Undeclared remote code is
   grounds for rejection, and MV3 forbids loading remotely hosted code anyway [S4].
4. **Data usage disclosures and certifications:** check the data types handled and certify Limited
   Use compliance [S4][S6].
   - The CWS FAQ says disclosure is required "even when data is processed or stored locally on a
     user's device", and lists "Authentication information (such as logins, password, and
     authentication cookies)" as user data [S5]. **So the optional token must be disclosed as
     Authentication information** even though it never leaves the user's machine except to GitHub.
   - Website content: the extension reads the GitHub page DOM to transform it. Whether purely
     local DOM transformation needs a "Website content" checkbox is not stated explicitly. The FAQ's
     "processed ... locally" wording suggests disclosing it. Unverified; err toward disclosure.
   - "Collection and use of web browsing activity is prohibited" except for a prominently
     described user-facing feature [S6]. The extension must not log or transmit visited URLs.
5. **Privacy policy URL:** required "If your Product handles any user data" [S7]. Because of item
   4, publish a short privacy policy (for example `PRIVACY.md` in the repository, linked from the
   listing). It must say what is handled and with whom it is shared [S7]: the token is stored
   locally and sent only to `api.github.com`; there is no telemetry and nothing is sent to the
   developer. The site or policy must also carry an affirmative Limited Use compliance statement
   [S6].

### Review

- "For most extensions, review is completed within a few days, but it can take up to a few weeks."
  Contact support after three weeks [S8].
- New developers, new extensions, "dangerous" permission requests and large code changes get
  closer review [S8]. Broad patterns like `<all_urls>` attract scrutiny [S8]. This project's narrow
  host list helps.
- Obfuscation is disallowed. Minification is allowed but discouraged, and submitting readable code
  is recommended [S8]. Consider disabling minification in the release build (WXT/Vite option) for
  easier review in both stores.
- Rejections name the violated policy and can be appealed from the item page [S8].

## 2. addons.mozilla.org (AMO)

### Listed vs self-distributed

- Release and Beta Firefox install only Mozilla-signed extensions [S9]. Unsigned installs work only
  in Developer Edition, Nightly and ESR with `xpinstall.signatures.required` disabled [S9].
- **Listed:** public on AMO, with automatic updates [S9].
- **Unlisted (self-distributed):** signed by AMO but "cannot be publicly viewed or installed from
  AMO". Suited to betas. Self-hosted updates use `gecko.update_url` [S9].
- Signing "can take up to 24 hours", or longer if the submission is picked for manual review. "All
  add-ons are subject to a manual code review at any time after submission", listed or not [S9].
- Recommendation: listed channel for releases; optionally unlisted for pre-release testers.

### Policy points that apply [S11][S12]

- "Add-ons must be self-contained and not load remote code for execution" [S11]. API JSON is data,
  not code, so it is fine.
- "Add-ons must limit data transmission to what is necessary for functionality" [S11]. Data
  transmission means data handled "outside of the add-on or the local browser" [S11].
- "Add-ons must use encryption when transporting data remotely" [S11]. All GitHub calls are HTTPS.
- "Add-ons must only request those permissions that are necessary for them to function" [S11].
- No obfuscation. "Minification of code with the intent to reduce file size is permitted" [S12].
- If an account is needed for functionality, provide test credentials to reviewers [S11]. Not
  required here, since the extension works on public repositories without a token. Say so in the
  reviewer notes.
- **Policy change:** an updated policy set takes effect **Dec 1, 2026**. For add-ons compatible only
  with Firefox 140+ that use built-in consent, the manifest "must accurately state the data
  collection practices ... including when it does not collect data" [S12]. With `strict_min_version`
  140 and `"required": ["none"]`, the project meets this.
- `data_collection_permissions` is required for new extensions (since Nov 3, 2025). The recommended
  value is `{"required": ["none"]}`; rationale and the `authenticationInfo` question are in
  `firefox-mv3.md` [S14].

### Source code submission

WXT bundles with Vite, so AMO requires source code for every version [S10]:

- Required when code is produced by "tools that generate a single file from other files, such as
  browserify or webpack", minifiers, or template engines [S10].
- Include all source (and any private dependencies), the **lockfile**, the build script, and a
  **README with build instructions** [S10]:
  - OS and environment requirements;
  - required tool versions with install steps (Node, package manager);
  - the exact commands to produce the submitted package.
- Build tools must be open source and run locally, not web-based [S10].
- Reviewers rebuild and diff: "There must be no differences" [S10]. The build must be
  deterministic. Pin Node and the package manager, commit the lockfile, and avoid embedding build
  timestamps or git hashes that differ between machines.
- Default reviewer environment if none is specified: Ubuntu 24.04 LTS (ARM64), Node 24.14.0, npm
  11.9.0, 10 GB RAM, 6 vCPU [S10]. Matching this (or documenting deviations) avoids rejections.
  Note the ARM64 architecture: avoid native build dependencies with x86-only binaries.
- Source archive limit: 200 MB [S10]. Exclude `node_modules` and `.output`. WXT's `wxt zip -b
  firefox` produces a sources zip alongside the extension zip (WXT feature, not verified in this
  research).

### `web-ext`

- `web-ext lint`: validates manifest and sources. Useful flags: `--warnings-as-errors` / `-w`,
  `--self-hosted` (suppresses AMO-hosting messages), `--output json` [S13]. Run it in CI on the
  Firefox build. Lint rules include `MISSING_DATA_COLLECTION_PERMISSIONS` (reported in community
  sources; not verified against the current linter).
- `web-ext sign` [S13]:
  - `--channel listed|unlisted` (required since web-ext 8);
  - `--api-key` / `--api-secret` (AMO JWT credentials), also via `WEB_EXT_API_KEY` /
    `WEB_EXT_API_SECRET`. Keep these in CI secrets only;
  - `--amo-metadata <json>`: required for the first listed version (categories, summary, license);
  - `--upload-source-code <zip>`: attaches the source archive;
  - `--approval-timeout <ms>` (default 900000; 0 disables waiting).
- The reference is web-ext v10 (March 2026) and requires Node.js 22+ [S13].

## 3. Microsoft Edge Add-ons (optional)

- "There is no registration fee" [S16]. Registration uses Partner Center with a Microsoft account.
  A GitHub account can be used to create one [S16].
- The Chromium MV3 package is reusable. Upload a `.zip` [S15].
- The Privacy page mirrors CWS: single purpose, per-permission justification, remote-code
  declaration, data-usage certification, privacy policy URL [S15].
- Listing: description of 250 to 10,000 characters, a 1:1 logo (300x300 recommended, 128x128
  minimum), optional screenshots at 640x480 or 1280x800 [S15].
- Certification "can take up to seven business days" [S15].

## 4. Pre-submission checklist

- [ ] Chrome manifest: only `storage` plus GitHub host patterns; no `scripting`, `tabs`,
      `activeTab`, `<all_urls>`.
- [ ] Firefox manifest: `gecko.id` final, `strict_min_version`, `data_collection_permissions:
      {required: ["none"]}`, MV3 build (`--mv3`).
- [ ] No remote code; no `eval`; no CDN script tags in the options page.
- [ ] Privacy policy published (token local-only, sent only to `api.github.com`, no telemetry,
      Limited Use statement).
- [ ] CWS privacy tab answers and justifications drafted (section 1).
- [ ] Reproducible build: pinned Node and package manager, committed lockfile, `SOURCE-BUILD.md`
      or README section with exact commands; verified by rebuilding on a clean machine and diffing.
- [ ] `web-ext lint -w` clean on the Firefox build.
- [ ] Store assets: icons (16/32/48/96/128), screenshots, short and long descriptions.
- [ ] Reviewer notes: how to test on a public repository; the token is optional.

## Unverified claims

- The current CWS registration fee amount (US$5 per a 2020 Chromium Blog post; the current page
  omits it).
- Whether local-only DOM transformation requires the CWS "Website content" disclosure.
- WXT `zip` producing an AMO-ready sources archive automatically.
- The current addons-linter rule names for data-collection checks.

## Open questions

1. Publish on Edge Add-ons at v1 or later? It is cheap (no fee, same package) but adds a third
   listing to maintain.
2. Ship minified or unminified bundles? Unminified eases both reviews. The size impact is small for
   this extension.
3. Where to host the privacy policy: a repository file URL, or GitHub Pages?
4. Use an unlisted AMO channel for beta testers before the first listed release?
