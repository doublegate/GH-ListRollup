# Security and Privacy

**Status:** Draft v0.1 (2026-11-15) | **Tickets:** Phase 4 Sprint 2 (review), and every ticket that adds DOM
or network code
**Sources:** `ref-docs/research-report.md` §4-§5, `ref-docs/chrome-mv3.md`, `ref-docs/firefox-mv3.md`

## 1. Assets and boundaries

| Asset                               | Where it lives                                                                     | Threat                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| The user's GitHub session (cookies) | Browser cookie jar; used implicitly by same-origin fetches from the content script | A bug that sends requests the user did not intend, or to the wrong origin |
| Optional GitHub token               | `storage.local`, read only by the background script                                | Leak through logs, sync, errors, page access or other origins             |
| Private repository names and paths  | GitHub pages the user views                                                        | Exfiltration through telemetry or third-party requests                    |
| The GitHub page's integrity         | DOM of github.com                                                                  | Injected markup from repository-controlled strings (file names)           |

Attacker model: anyone who can create a repository, and so controls file and folder names, branch
names, and README content. They cannot run code in the extension's contexts.

## 2. Rules

1. **No HTML from strings.** File, folder and ref names are repository-controlled. Build every node
   with `document.createElement` and set text via `textContent`. `innerHTML`, `outerHTML`,
   `insertAdjacentHTML` and `DOMParser` on data are forbidden; ESLint enforces this
   (`no-restricted-properties` / `no-unsanitized` plugin). Static SVG icons are created with
   `createElementNS` from constant path data.
2. **URLs are built, not concatenated.** Child links are built with `new URL()` from the current origin
   plus percent-encoded path segments (`encodeURIComponent` per segment). Names such as `..`, `%2e`,
   `#` or `?` must still produce a correct GitHub URL. The test suite covers these.
3. **One origin.** Host permissions are `https://github.com/*` and, for the fallback,
   `https://api.github.com/*` only. No other network origin is ever contacted. No analytics, crash
   reporting, remote config or remote code; MV3 forbids remote code anyway.
4. **Token isolation.** The token is read only in the background script. The content script asks the
   background for "children of `owner/repo@ref:path`" and never sees the token. The token is never
   logged, never put into an error message (errors carry status code and a correlation id), never stored
   in `storage.sync`, and is sent only to `https://api.github.com` with `Authorization: Bearer`.
   Documentation recommends a fine-grained token with read-only **Contents** permission, or no token.
5. **Message validation.** The background script accepts messages only from its own extension
   (`sender.id === browser.runtime.id`, and a content script on a github.com URL). It validates the
   message shape and each owner/repo/ref/path component against GitHub's name rules before building a
   request.
6. **Bounded work.** At most 4 concurrent child fetches per tab; cached responses are reused; a folder is
   never fetched twice concurrently (in-flight de-duplication). Large folders are capped
   (`docs/ui-behavior.md` §3.2).
7. **Least privilege in the page.** Content scripts run in the ISOLATED world. Nothing is injected into
   the page's MAIN world; no page globals are read or patched.
8. **Dependencies.** Runtime dependencies are kept near zero (WXT's runtime helpers only). `pnpm audit`
   runs in CI; lockfile committed; GitHub Actions pinned by version.

## 3. Privacy statement (for store listings)

The extension:

- collects no data
- sends nothing anywhere except to GitHub, on the user's behalf, to load folder contents the user asked
  to expand
- stores preferences in the browser's extension storage
- stores an optional token only on the device it was entered on

Firefox manifest: `data_collection_permissions.required = ["none"]`. Chrome Web Store privacy tab: no
data collected; single purpose "collapse and expand the file listing on GitHub repository pages".

## 4. Review checklist (run before each release)

- [ ] `rg -n "innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function" src entrypoints` returns nothing.
- [ ] Manifest permissions unchanged from `docs/cross-browser.md`, or the change is justified in the
      CHANGELOG.
- [ ] Token never appears in logs: run the E2E suite with `debug.logging` on and grep the output for
      the test token.
- [ ] Hostile-name fixture tests pass (names with `<img onerror>`, `..`, `%2F`, RTL override, 255-char names).
- [ ] `pnpm audit --prod` is clean.
