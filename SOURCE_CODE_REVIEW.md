# Source Code Review Instructions (Mozilla Add-ons / AMO)

**Add-on:** GH ListRollup (`gh-listrollup@lparobek.dev`)
**Version:** `0.1.0`
**Repository:** <https://github.com/doublegate/GH-ListRollup>
**License:** MIT OR Apache-2.0

---

## 1. Overview for Reviewers

GH ListRollup is a Manifest V3 browser extension built with [WXT](https://wxt.dev) (`0.21.5`) and TypeScript (`6.0.3`).

- **What it does in v0.1.0:** On GitHub repository code listing pages (`https://github.com/<owner>/<repo>` and `/<owner>/<repo>/tree/<ref>[/<path>]`), it collapses the file and folder table to a single header line (the latest-commit bar) and inserts an accessible chevron toggle button (`button[data-gnr="toggle"]`) that expands and collapses the listing.
- **No account or token required:** Reviewers can test the extension while logged out on any public GitHub repository (for example, <https://github.com/wxt-dev/wxt> or <https://github.com/refined-github/sandbox/tree/branch/with/slashes>).
- **Security and privacy invariants:**
  - Runs in the `ISOLATED` content-script world on `https://github.com/*` only.
  - Requests only `host_permissions: ["https://github.com/*"]` (no `tabs`, `scripting`, `webRequest`, or `storage` permissions in `v0.1.0`).
  - Declares `data_collection_permissions: { "required": ["none"] }`. Collects zero data, has zero telemetry, and makes zero network requests in `v0.1.0`.
  - Never parses strings as HTML (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `DOMParser.parseFromString`, and `Range.createContextualFragment` are banned in `src/` and enforced by ESLint).
  - Ships unminified ES module output (`content-scripts/content.js`, `background.js`) with no obfuscation.

---

## 2. Build Environment Requirements

- **Operating System:** Linux (tested on Ubuntu 24.04 LTS x86_64/ARM64 and Arch Linux)
- **Node.js:** `>= 22.18.0` (Node 24 LTS or Node 26 LTS; `.nvmrc` specifies `26`)
- **Package Manager:** `pnpm@12.21.0` (pinned via the `packageManager` field in `package.json`; enabled with `corepack enable`)

All dependencies in `package.json` and `pnpm-lock.yaml` are pinned to exact versions.

---

## 3. Exact Steps to Rebuild from Source

From the root of the extracted `gh-listrollup-0.1.0-sources.zip` archive:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build:firefox
```

To also produce the packaged `.zip` archive:

```sh
pnpm zip:firefox
```

### Build Outputs

- **Unpacked Firefox MV3 extension:** `.output/firefox-mv3/`
  - `.output/firefox-mv3/manifest.json`
  - `.output/firefox-mv3/background.js`
  - `.output/firefox-mv3/content-scripts/content.js`
  - `.output/firefox-mv3/content-scripts/content.css`
  - `.output/firefox-mv3/icon/{16,32,48,96,128}.png`
- **Packaged Firefox MV3 zip:** `.output/gh-listrollup-0.1.0-firefox.zip`

---

## 4. Verifying Byte-for-Byte Reproducibility

To verify that the rebuilt output matches the submitted `.zip` byte-for-byte:

```sh
mkdir -p /tmp/submitted-xpi
unzip -q path/to/submitted/gh-listrollup-0.1.0-firefox.zip -d /tmp/submitted-xpi
diff -r /tmp/submitted-xpi .output/firefox-mv3
```

`diff -r` exits `0` with no output.

---

## 5. Source Layout Map

| Path                                | Purpose                                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `wxt.config.ts`                     | Shared MV3 manifest configuration and Firefox `browser_specific_settings.gecko` block                                               |
| `public/icon/`                      | Extension icons (`16.png`, `32.png`, `48.png`, `96.png`, `128.png`)                                                                 |
| `src/entrypoints/content/index.ts`  | Content script entrypoint (`matches: ["https://github.com/*"]`, `runAt: "document_start"`)                                          |
| `src/entrypoints/content/style.css` | Scoped CSS rules for `html[data-gnr-pending]`, `html[data-gnr-collapsed]`, and `[data-gnr="toggle"]`                                |
| `src/entrypoints/background.ts`     | Background event page (Firefox) / service worker (Chrome)                                                                           |
| `src/features/collapse.ts`          | `CollapseController`: idempotent `apply()`, pre-hide & collapsed state on `<html>`, 4s watchdog, teardown recovery                  |
| `src/features/lifecycle.ts`         | Cold-load pre-hide, capture-phase click / `popstate` navigation pre-hide, soft-navigation observer wiring                           |
| `src/ui/toggle.ts`                  | Native `<button type="button" data-gnr="toggle">` builder with Octicon chevron SVG                                                  |
| `src/github/`                       | Pure page detector (`page.ts`), ranked selectors (`selectors.ts`), commit-bar locator (`header.ts`), navigation listener (`nav.ts`) |
