# Prior Art: GitHub File-Listing Extensions

Retrieved: 2026-11-15

Scope: existing extensions and libraries that modify GitHub's repository file listing or add file
trees. For each one: what it does, where its data comes from, its license, and what GH-ListRollup
should take from it. Source files were read through the GitHub API. Quoted code is limited to short
fragments.

## Sources

- [S1] https://github.com/refined-github/refined-github: Refined GitHub (MIT, about 32.5k stars,
  active 2026-11-15).
- [S2] https://github.com/refined-github/refined-github/blob/main/source/helpers/selector-observer.tsx:
  RGH's CSS-animation-based element observer.
- [S3] https://github.com/refined-github/refined-github/blob/main/source/feature-manager.tsx: RGH's
  feature lifecycle, including soft-navigation handling through Turbo and `soft-nav` events.
- [S4] https://github.com/refined-github/refined-github/pull/7741: "`toggle-files-button` - Drop
  feature" (merged 2024-08-26), with the maintainer's rationale.
- [S5] https://github.com/refined-github/refined-github/blob/9f7dd6b39/source/features/toggle-files-button.tsx
  (and the `.css` next to it): the last source of RGH's file-list collapse feature before removal.
- [S6] RGH features `file-age-color.tsx`, `download-folder-button.tsx` and
  `clean-repo-filelist-actions.css` (main branch): current selectors for the React file list.
- [S7] https://github.com/refined-github/github-url-detection (`index.ts`): page-type detection, MIT,
  v11.2.4.
- [S8] https://github.com/fregante/select-dom, https://github.com/sindresorhus/element-ready,
  https://github.com/fregante/delegate-it: DOM helper libraries, all MIT.
- [S9] https://github.com/brumm/tako: Tako (README, `src/lib/github-page.tsx`, `src/content.tsx`,
  `src/lib/repo-tree.ts`, `src/lib/tree-commit-info.ts`, `package.json`). MIT, active 2026-10.
- [S10] https://github.com/EnixCoda/Gitako: Gitako (README,
  `src/platforms/GitHub/embeddedDataStructures.ts`, `DOMHelper.ts`, `API.ts`,
  `e2e/drift.selectors.spec.ts`). MIT, active 2026-11.
- [S11] https://github.com/ovity/octotree: Octotree (README and the legacy `src/adapters/github.js`).
  The repository is tagged AGPL-3.0, and its README says the product is proprietary.
- [S12] https://github.blog/changelog/2022-11-09-introducing-an-all-new-code-search-and-code-browsing-experience/
  and https://github.blog/engineering/user-experience/considerations-for-making-a-tree-view-component-accessible/:
  GitHub's native code-view tree pane and its accessibility design.
- [S13] Store listings found by search, not inspected in depth: "Github File Tree (Octofree)"
  (Chrome Web Store), "OctoNext" (Firefox), "GitHub Folder View Plus" (AMO), "Tako" (AMO).
- [S14] npm registry (2026-11-15): `github-url-detection@11.2.4` (2026-08-02, node `>=22.18`,
  ESM-only), `select-dom@10.1.0`, `element-ready@9.0.2`, `delegate-it@6.4.0`.

## Summary table

| Project | What it does | Data source | License | Status |
|---|---|---|---|---|
| Refined GitHub | Hundreds of small GitHub UI tweaks. Had a whole-file-list collapse toggle from about 2019 until it was dropped in August 2024 | DOM, page detection, occasionally the REST/GraphQL API with a token | MIT | Very active |
| Tako | **Replaces** the repository file list with an inline expandable tree and file preview | GitHub **GraphQL API with a personal access token**, plus the undocumented `tree-commit-info` JSON endpoint with the session cookie | MIT | Active, small (about 200 stars) |
| Gitako | Sidebar file tree for repositories and PRs | REST `git/trees?recursive=1` API, plus page embedded JSON (`react-app.embeddedData`) | MIT | Active |
| Octotree | Sidebar file tree (freemium) | REST `git/trees` (recursive), token optional | Legacy repository AGPL-3.0, product proprietary | Legacy repository stale since 2024 |
| GitHub native tree pane | Left tree pane in code view (file and folder pages) | First-party | n/a | Shipped 2022 onward |
| Octofree, OctoNext, Folder View Plus | Sidebar trees; Folder View Plus is unclear | Not inspected | Not inspected | Unverified [S13] |

None of these does exactly what GH-ListRollup proposes: **collapsed by default at both levels,
keeping GitHub's own rows and links, folders expanded in place, no token**. Tako is the closest, but it
replaces the native listing and requires a PAT. RGH's removed `toggle-files-button` matches Level 1
almost exactly.

## Refined GitHub

### Page detection: `github-url-detection` [S7]

- Pure-ESM, MIT. URL detectors take an optional `URL`, `Location` or `HTMLAnchorElement` (not a
  string) and default to `location`. Some detectors read the DOM instead.
- The detectors that matter here:
  - `isRepoTree(url)`: `_isRepoRoot(url)` or a path starting with `tree/`. It covers the repository
    home, `/tree/<ref>` and `/tree/<ref>/<path>`. **This matches the Level 1 scope exactly.**
  - `isRepoRoot(url)`: home or `/tree/<ref>` with no sub-path, excluding search parameters.
  - `isRepoHome(url)`: `/<owner>/<repo>` exactly.
  - `isEmptyRepoRoot()` (DOM based, looks for `.blankslate-icon` or `#empty-setup-clone-url`).
    `isEmptyRepo` is deprecated as "Doesn't work anymore".
  - `isRepoFile404()` checks `document.title.startsWith('File not found')`.
- The detectors are unit-tested against real URL lists, including "gotcha" URLs such as
  `/sindresorhus/edit` and `?files=1`. The project could depend on it directly (MIT, small) or copy
  the pattern. The `node >=22.18` engines field only affects tooling [S14].

### DOM helpers [S8]

- `select-dom`: `$`, `$$`, `$optional`, `$closest`, typed `querySelector` wrappers. `$` throws when
  nothing matches, which surfaces selector drift loudly in development.
- `element-ready`: `await elementReady(selector, { signal, stopOnDomReady, waitForChildren, predicate })`
  and `observeReadyElements`. It accepts an `AbortSignal`, which pairs well with WXT `ctx.signal`.
- `delegate-it`: `delegate(selector, 'click', handler, { signal })` and `oneEvent`. Delegation
  survives GitHub re-rendering rows, because the listener sits on the document and not on the rows.

### Soft navigation and DOM churn [S2][S3]

- **Unload:** RGH aborts every feature's `AbortController` on `turbo:before-fetch-request` (clicks)
  and `turbo:visit` (back/forward) [S3].
- **Re-init:** each feature loops
  `do { ...init(signal) } while (await oneEvent(document, ['turbo:render', 'soft-nav:react-done']))`
  [S3]. GitHub's own document events are therefore the re-run trigger, not URL polling. The same
  events are used to re-apply CSS-off attributes "GitHub cleans up ... after navigation".
- **Element appearance:** `observe(selector, cb, { signal })` [S2] injects
  `@keyframes rgh-selector-observer {}` and a rule `:where(<selector>):not(.rgh-seen-<id>) {
  animation: 1ms rgh-selector-observer }`, listens for `animationstart`, and marks each element seen
  with a class. This catches elements that React mounts at any time without a document-wide
  `MutationObserver`. Firefox note from the source: "Firefox <153 denies content scripts access to
  adoptedStyleSheets", so the observer falls back to a `<style>` element.
- Features take `include: [pageDetect.isRepoTree]` and `exclude: [...]` lists, re-evaluated on every
  soft navigation [S3][S6].

### `toggle-files-button`: direct Level 1 prior art [S4][S5]

- Behavior (last version, August 2024): it added a chevron button to the latest-commit box, found via
  `observe('[data-testid="latest-commit-details"] span', ...)` and then `closest('[class^="Box"]')`.
  Clicking toggled `body.rgh-files-hidden`, and CSS hid `.react-directory-row`. The state was
  remembered **per repository** (`CachedFunction` keyed `cacheByRepo`). When collapsed, a notice
  under `[aria-labelledby="folders-and-files"]` read "The file list was collapsed via Refined GitHub"
  [S5].
- It guarded against duplicates (`elementExists('.rgh-toggle-files')`, issue #7737) and skipped
  `isSingleFile()` [S5]. This shows that GitHub's React view re-renders the commit box often enough to
  produce duplicate injections.
- **Why it was dropped** [S4]: the maintainer wrote "This feature makes no sense", arguing that the
  only reason to hide the list is to reach the README and that GitHub already offers a README jump on
  the home page. He conceded two drawbacks: no README link on non-root `/tree/` views, and users who
  never use the file list have to scroll on every load.
- **Lessons:** (a) user demand for Level 1 existed long enough to justify two "Restore feature" PRs
  in 2024 [S5]. (b) The feature broke repeatedly as GitHub moved the file list to React. Expect the
  same churn and isolate selectors. (c) Hiding rows with a body-level class plus CSS is cheap and
  survives re-renders better than removing nodes. (d) Show collapsed state explicitly so users are
  not confused about missing files. (e) Decide deliberately between per-repository memory and a
  global default. The concept doc says collapsed by default, which differs from RGH's opt-in
  default.

### Current file-list selectors in RGH (main, 2026) [S6]

`.react-directory-commit-age > [title]` (row age cell), `div[class^='OverviewContent']`,
`span[class*='FileResultsList']`, `ul[role="menu"]:has([aria-keyshortcuts="c"])` (Code menu). Hashed
class names are matched by prefix (`[class^=...]`), and stable hooks are preferred: `data-testid`,
`aria-*`, `react-directory-*`.

## Tako [S9]

- **What:** "replaces the default repository file listing with an interactive file tree and
  integrated file preview". Directories load on hover. It has optional single-child directory
  collapsing, symlink resolution, and submodule browsing. It is MV3 for Chrome and Firefox.
- **Mounting:** it waits for `'[data-hpc]:has([aria-labelledby=folders-and-files])'`, adds GitHub's
  `d-none` class to the native table, and mounts a React root after it. Unmounting restores the
  table. It checks `container.isConnected` to detect GitHub having thrown its DOM away [S9]. Other
  selectors: `[class^=prc-PageLayout-Pane-]` and `[class^=prc-PageLayout-Content-]` (Primer React
  hashed classes).
- **Data:** the **GraphQL API** (`repository.object(expression: "<ref>:<path>") { ... on Tree {
  entries { name path type mode oid submodule } } }`) through Octokit, which **requires a PAT**. A
  token prompt is shown if none is stored [S9]. Last-commit info comes from the undocumented
  `https://github.com/<owner>/<repo>/tree-commit-info/<ref>/<path>` with `Accept: application/json`,
  "authenticated by session cookie" [S9].
- **Firefox detail:** `pageFetch = globalThis.content?.fetch ?? fetch` [S9]. In Firefox, the
  content-script `fetch` runs with the extension's principal. `content.fetch` issues the request as
  the page, so the cookie and Origin behave like GitHub's own requests. **This is directly relevant
  to lazily fetching folder contents from github.com without a token.**
- Detection uses `github-url-detection` `isRepoTree`. A `visibilitychange` gate defers work in
  background tabs [S9].
- Tooling: `@crxjs/vite-plugin`, not WXT. Vitest 4 with `@vitest/browser-playwright`, happy-dom, msw,
  and `webextension-polyfill` [S9].
- **Lessons:** the inline tree is feasible and wanted. Replacing the native table costs GitHub's
  native affordances (row links, commit messages, ages) and forces re-implementing them, and the
  token requirement adds friction. GH-ListRollup's design (keep native rows, insert child rows,
  no token) avoids both. `content.fetch` and the `tree-commit-info` endpoint are evidence that
  same-origin session-cookie JSON endpoints work from a content script.

## Gitako [S10]

- **What:** a sidebar file tree for repositories and PRs. It supports GitHub Enterprise, Gitea, Gitee
  and private repositories (with a token), keyboard navigation, and code folding.
- **Data:** the REST `GET /repos/{o}/{r}/git/trees/{ref}?recursive=1` (`api.github.com` or
  `<host>/api/v3` on Enterprise) [S10]. It also parses **embedded page JSON**:
  `script[type="application/json"][data-target="react-app.embeddedData"]` inside
  `react-app[app-name="code-view"]` (signed-in) or `react-app[app-name="react-code-view"]`
  (anonymous), and `[partial-name="repos-overview"] script[data-target="react-partial.embeddedData"]`
  on the repository overview [S10].
- Its superstruct schema for that payload shows a `tree` object with
  `items: [{ name, path, contentType }]`, `totalCount`, `refInfo { name, currentOid, refType }`, and
  `repo { defaultBranch, ownerLogin, isEmpty, ... }` [S10]. Signed-in and anonymous payloads differ:
  "Signed-in users see refInfo nested under codeViewTreeRoute / codeViewLayoutRoute; anonymous users
  get it directly on payload". Commit data moved between layouts as well [S10]. **The embedded JSON
  shape drifts and depends on login state. Validate it with a schema and fail soft.**
- **Drift tripwire E2E:** `e2e/drift.selectors.spec.ts` checks every DOM selector against a live URL
  with an expected count. Its comment says "a selector that silently starts matching zero (or worse,
  the wrong number of) elements is the #1 source of regressions" [S10]. Adopt this.
- **Lessons:** keep all selectors in one module (Gitako's `DOMHelper` selector map) so drift fixes
  are one-line changes. Embedded JSON can give the ref, `currentOid` and the top-level listing without
  any request.

## Octotree [S11]

- **What:** the original sidebar code tree, now a freemium product. The README says: "Octotree is a
  **proprietary** software. This repository contains the old source code of a very limited version".
  GitHub's license detection reports AGPL-3.0 for the legacy repository.
- **Data (legacy source):** REST `/git/trees/<branch>?recursive=1`, falling back to lazy per-tree
  fetches when `data.truncated` is set (the recursive tree API truncates very large repositories). It
  also uses the pjax container selector `#js-repo-pjax-container`, and notes that it "couldn't do this
  in response to URL change, since new DOM via pjax might not be ready" [S11]. That is the same
  navigation-before-DOM problem `wxt:locationchange` has.
- **Lessons:** the recursive tree API truncates. Lazy per-folder fetching, as the concept doc plans,
  avoids that. Do **not** copy any Octotree code: it is AGPL or proprietary, and incompatible with
  `MIT OR Apache-2.0`.

## GitHub's native tree pane [S12]

- The 2022 code view added a left tree pane for browsing "folders and files without changing pages".
  It is built as an accessible ARIA tree (`aria-expanded` on directory nodes, wrapped in a `nav`
  landmark) [S12].
- On repository home pages GitHub shows the classic listing table, not the tree pane. On `/tree/`
  folder pages and `/blob/` pages, the pane can be toggled. Current exact behavior was **not
  re-verified** in this pass. Non-goals in the concept doc exclude changing that pane.
- **Lessons:** match GitHub's own accessibility model for inserted child rows (tree or treegrid
  semantics, `aria-expanded`, `aria-level`, keyboard support), and do not fight the native pane on
  `/tree/` pages.

## Other extensions [S13] (unverified)

Search turned up "Github File Tree (Octofree)" (sidebar, private repositories, branch switching),
"OctoNext" (sidebar with lazy-loaded folders), and "GitHub Folder View Plus" (AMO, folder structure
view, behavior unclear). None was inspected. None appears to collapse the native listing or expand
folders inline while keeping native rows.

## Consolidated lessons for GH-ListRollup

1. **Scope detection:** use `github-url-detection`'s `isRepoTree` (MIT) or an equivalent tested on
   the same URL corpus. Exclude `isRepoFile404`, empty repositories (`isEmptyRepoRoot`) and
   single-file pages [S5][S7].
2. **Navigation:** treat a URL change as "the page is about to change". Re-apply on GitHub's
   `turbo:render` / `soft-nav:react-done` events and when the listing element appears. Abort
   per-page work on `turbo:before-fetch-request` / `turbo:visit`, all tied to WXT's `ctx.signal`
   [S3][S11].
3. **Element appearance:** a CSS `animationstart` observer [S2] or `element-ready` [S8] is cheaper
   than broad MutationObservers. Mark processed nodes to keep injection idempotent, since RGH hit
   duplicate injections [S5].
4. **Collapse via CSS classes, not DOM removal.** A root class plus a stylesheet survives React
   re-renders [S5]. Inserted child rows, though, must be re-attached or re-rendered when GitHub
   re-renders the table. Keep a cache keyed by `owner/repo@ref:path` and re-attach from it.
5. **Selectors:** prefer `aria-labelledby="folders-and-files"`, `data-testid`, `react-directory-*`,
   and prefix matching on hashed `prc-*` classes [S5][S6][S9]. Keep them in one module, with a
   scheduled live drift test [S10].
6. **Data without a token:** options are page embedded JSON (`react-app.embeddedData` /
   `react-partial.embeddedData`) for the current level [S10], and same-origin session-cookie JSON
   endpoints for child folders. Tako proves `tree-commit-info` works [S9]. In Firefox, use
   `content.fetch` [S9]. The REST and GraphQL APIs need tokens or hit anonymous rate limits [S9][S11].
   Validate every payload with a schema, because its shape differs between signed-in and anonymous
   users [S10].
7. **Show state:** a visible collapsed indicator, as in RGH's "file list was collapsed" notice [S5],
   and decide whether state is remembered globally, per repository, or not at all.
8. **Licensing:** RGH, Tako, Gitako and the helper libraries are MIT. Patterns can be reused, and any
   copied code needs MIT notice retention, which is compatible with `MIT OR Apache-2.0`. Octotree
   code must not be used [S11].

## Unverified claims

- U1: The exact JSON endpoint GitHub's React file list uses to load a folder's children (for
  example `/<o>/<r>/tree/<ref>/<path>` with `Accept: application/json`) and its response shape. It
  was not fetched in this pass. Gitako's schema [S10] covers the embedded variant only.
- U2: `content.fetch` remains available to Firefox MV3 content scripts in current Firefox releases.
  Tako relies on it [S9], but Mozilla documentation was not checked.
- U3: Current native tree-pane behavior on home versus `/tree/` pages [S12].
- U4: Store-listing extensions in [S13] were not inspected.

## Open questions

- Q1: Depend on `github-url-detection` (ESM, `node >=22.18` engines) or vendor a minimal detector?
- Q2: Child-folder data source: the internal same-origin JSON endpoint (no token, undocumented) or
  the public REST contents API (documented, 60 requests per hour anonymous)? A spike is needed to
  confirm U1.
- Q3: Should collapse state be remembered per repository (RGH's choice) or default to collapsed every
  time (the concept doc's choice), with a global option?
- Q4: How should the extension coexist with Refined GitHub and Tako when they are installed together,
  since all of them change the same table?
