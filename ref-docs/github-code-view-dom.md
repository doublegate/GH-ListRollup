# GitHub Code View: Repository File Listing DOM

Retrieved: 2026-11-15

Scope: the folder/file listing on the React code view at `/<owner>/<repo>` (repo root "overview")
and `/<owner>/<repo>/tree/<ref>/<path>` (folder page), as served to a **logged-out** client on
2026-11-15. Companion docs: `github-navigation-events.md`, `github-data-sources.md`.

## Sources

- [S1] Direct observation (curl, logged out, generic browser User-Agent): `https://github.com/microsoft/vscode` (repo root overview page), 2026-11-15.
- [S2] Direct observation (curl, logged out): `https://github.com/microsoft/vscode/tree/main/src/vs` (folder page), 2026-11-15.
- [S3] Direct observation (curl, `Accept: application/json`): tree JSON for `microsoft/vscode` `src/vs`, `rust-lang/rust` `src/tools`, `git/git` root, `DefinitelyTyped/DefinitelyTyped` `types`, 2026-11-15.
- [S4] refined-github source, `main` branch tarball fetched 2026-11-15 (https://github.com/refined-github/refined-github): `source/github-helpers/selectors.ts`, `source/features/file-age-color.tsx`, `source/features/quick-file-edit.tsx`, `source/features/github-bugs.css`, `source/features/sticky-sidebar.tsx`, `source/helpers/selector-observer.tsx`.
- [S5] github-url-detection 11.2.4, `distribution/index.js` (https://unpkg.com/github-url-detection@11.2.4/distribution/index.js): `isRepoRoot`, `isRepoTree`, `getRepo`.
- [S6] GitHub JS bundles referenced by [S2] (https://github.githubassets.com/assets/core-*.js, app-runtime-*.js, react-core-*.js), fetched 2026-11-15: SSR detection code and soft-nav constants.
- [S7] GitHub Blog, "Crafting a better, faster code view" (2023-06-21): https://github.blog/engineering/architecture-optimization/crafting-a-better-faster-code-view/ - React adoption for code view.
- [S8] GitHub Changelog, "The new code search and code view is now generally available" (2023-05-08): https://github.blog/changelog/2023-05-08-the-new-code-search-and-code-view-is-now-generally-available
- [S9] GitHub Changelog, "Anonymous users have access to new code view and navigation" (2023-07-06): https://github.blog/changelog/2023-07-06-anonymous-users-have-access-to-new-code-view-and-navigation - file tree + symbols pane for anonymous users.
- [S10] GitHub Changelog, "Updates to repository pages" (2023-12-06): https://github.blog/changelog/2023-12-06-updates-to-repository-pages - "Go to file" on overview, special-file tabs beside README.
- [S11] GitHub Community discussion #61982, "New Repository Overview Public Beta Feedback" (2023-07-27): https://github.com/orgs/community/discussions/61982 - overview redesign beta; branch/tag counts removed for load cost.
- [S12] Mozilla Bugzilla 1267027, "[meta] Page CSP should not apply to content inserted by content scripts": https://bugzilla.mozilla.org/show_bug.cgi?id=1267027 (open).
- [S13] Mozilla Bugzilla 1706787, CSP error appending inline `<style>` from an extension: https://bugzil.la/1706787 - notes Chrome exempts isolated-world DOM from page CSP.
- [S14] Chrome for Developers, "Content scripts": https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts - isolated worlds, extension CSP, `run_at`.

Legend used below: **[observed]** = seen directly in the curl'd markup/JSON; **[claimed]** = a source
says so; **[inference]** = my reasoning, not verified.

## 1. Page shell and how to recognize a code-view page

- [observed] Both page types mount one React app: `<react-app app-name="code-view" ... data-ssr="true">`
  with an `initial-path` attribute and a `<script type="application/json" data-target="react-app.embeddedData">`
  payload [S1][S2]. The listing is **server-side rendered** into the HTML (rows present in the raw
  response), then hydrated. GitHub's own code checks `react-app[data-ssr="true"]` to decide whether
  SSR happened [S6].
- [observed] The app sits inside `<turbo-frame id="repo-content-turbo-frame" target="_top">` [S1].
- [observed] Route metas (marked `data-turbo-transient`, so they are swapped on Turbo visits):
  - root: `meta[name="route-pattern"]` = `/:user_id/:repository`, `route-controller` = `files`, `route-action` = `disambiguate` [S1]
  - folder: `route-pattern` = `/:user_id/:repository/tree/*name(/*path)`, same controller/action [S2]
- [observed] `body.logged-out` on anonymous pages; `meta[name="user-login"]` is empty [S1]. refined-github
  uses `body.logged-out` to detect anonymous sessions [S4].
- [claimed] github-url-detection defines `isRepoRoot` as repo path empty or `tree/<one-segment>` (with
  a title-based fallback for slash-containing branch names) and `isRepoTree` as root or `tree/...` [S5].
  The ref/path split for branch names containing `/` is ambiguous from the URL alone; the
  embedded JSON gives `refInfo.name` and `path` separately (see `github-data-sources.md`) [observed, S3].

## 2. Shared listing structure (both layouts)

[observed, S1][S2] The listing itself is identical in both layouts:

```text
div[data-hpc]                                   <- wrapper (also holds commit bar on root)
  h2#folders-and-files[data-testid="screen-reader-heading"]   "Folders and files" (sr-only)
  div[data-testid="directory-content"]
    table[aria-labelledby="folders-and-files"]
      thead > tr > th "Name" | th "Name" | th.hide-sm "Last commit message" | th "Last commit date"
      tbody
        tr#folder-row-0.react-directory-row   (one per entry, files too; ids are sequential)
          td.react-directory-row-name-cell-small-screen[colspan=2]
          td.react-directory-row-name-cell-large-screen[colspan=1]
          td.react-directory-row-commit-cell
          td > div.react-directory-commit-age
        ...
        tr[data-testid="view-all-files-row"]  ("View all files" button, mobile truncation)
```

Name cell contents (duplicated in the small-screen and large-screen cell; CSS shows one):

```text
div.react-directory-filename-column
  svg.octicon.octicon-file-directory-fill.icon-directory      (folder)
  svg.octicon.octicon-file.color-fg-muted                     (file)
  div.overflow-hidden > div.react-directory-filename-cell > div.react-directory-truncate
    a.Link--primary[href][title][aria-label="<name>, (Directory)" | "<name>, (File)"]
```

Observations that matter for the feature:

- [observed] **Row id `folder-row-N` is used for every row, files included**; it is an index, not a
  type. Type must come from the icon class, the `aria-label` suffix `(Directory)`/`(File)`, or the
  link `href` (`/tree/` vs `/blob/`) [S1].
- [observed] **Collapsed "simplified" paths**: a chain of single-child folders renders as one row
  whose link `title` is "This path skips through empty directories" and whose text is split into
  `span[data-testid="path-name-segment"]` pieces (e.g. `.agents/` `skills/` `launch`); `href` points
  at the deepest folder [S1]. The JSON marks these with `hasSimplifiedPath: true` [S3]. An inline
  expansion of such a row must expand the deepest folder.
- [observed] Other entry types in JSON: `submodule` (with `submoduleUrl`, `submoduleDisplayName`) and
  `symlink_file` [S3]. refined-github styles `a[aria-label$=', (Symlink to file)']` and treats
  `.octicon-file-symlink-file` as a file icon, which tells us the aria-label suffix varies by type [S4].
  Submodules and symlinks must not get an expansion arrow (or need special handling).
- [observed] Commit cells are SSR'd as `div.Skeleton.Skeleton--text` placeholders and filled
  client-side later from a deferred request [S1]; refined-github observes `.react-directory-commit-age > [title]`
  to catch the filled state [S4]. So React re-renders each row at least once after first paint
  [inference: injected nodes inside a row can be dropped or must be re-applied].
- [observed] Mobile truncation: rows after the 10th get class `truncate-for-mobile` and the
  `view-all-files-row` reveals them [S1]. A literal class `undefined` appears on early rows, i.e.
  React interpolated an undefined value: evidence that class lists here are not curated API [S1].
- [observed] Hashed CSS-module classes such as `Box_3__eg9tXU`, `OverviewTable__rPbUfl`,
  `Box__0K17vj` are present everywhere around the table; Primer classes carry hashes too
  (`prc-Button-ButtonBase-9n-Xk`) [S1]. These change per deploy and **must not be used as selectors**
  [inference, consistent with refined-github avoiding them except via `[class^="prc-PageLayout-Pane"]`
  prefix matches, S4].

## 3. Repo root (overview) layout

[observed, S1] Order inside the main column:

1. **Header row** (no stable wrapper attribute; hashed `Box_*` classes):
   - branch picker `button#ref-picker-repos-header-ref-selector` (`aria-label="main branch"`,
     `data-testid="anchor-button"`), also used by refined-github's `branchSelector` [S4];
   - "Branches" and "Tags" link buttons (no counts shown logged out; counts were removed in the
     overview redesign for load cost [S11]);
   - "Go to file" input `input[aria-label="Go to file"][role="combobox"]` plus a "Go to file" button;
   - "Code" button (label text "Code", `octicon-code`), kebab "Open more actions menu".
2. **Listing box** `div[data-hpc]` containing, in order: the **latest-commit bar** (bordered,
   `rounded-top-2`, with `h2` "Latest commit" sr-only, `[data-testid="latest-commit-details"]`,
   history link), then `h2#folders-and-files`, then `[data-testid="directory-content"]` table.
   On the root page the table carries an extra `OverviewTable*` hashed class.
3. **README area**: a sibling after the `data-hpc` box: `nav[aria-label="Repository files"]`
   (README / license / etc. tabs, per [S10]) and `article.markdown-body`.
4. About sidebar in a separate right-hand pane.

Implication [inference]: on the root page the natural "single header line" for the collapsed state is
either the header row (branch picker ... Code) or the latest-commit bar. Collapsing
`[data-testid="directory-content"]` alone leaves the commit bar visible as the header and keeps the
README in place, which fits the concept doc. The header row has no stable hook other than the
`#ref-picker-repos-header-ref-selector` descendant (use `closest()` from it, carefully).

## 4. Folder page (`/tree/<ref>/<path>`) layout

[observed, S2]

- **Sticky header** `div#StickyHeader` containing the breadcrumb (`[data-testid="breadcrumbs"]`,
  `[data-testid="breadcrumbs-repo-link"]`, `[data-testid="breadcrumbs-filename"]`), the branch picker
  `button#ref-picker-repos-header-ref-selector-wide` (different id than root), and the file-tree
  toggle `[data-testid="expand-file-tree-button"]` / `expand-file-tree-button-mobile`.
- **Latest-commit bar** is a *separate* bordered box (`rounded-2`) *before* the listing (not inside
  the listing's `data-hpc` wrapper, unlike the root page). Same inner hooks: sr-only `h2` "Latest
  commit", `[data-testid="latest-commit-details"]`.
- **Listing** `div[data-hpc] > [data-testid="directory-content"] > table` (no `OverviewTable` class).
  The first row `tr#folder-row-0` is the **parent-directory row**: no `react-directory-row` class,
  one `td[colspan=3]` with `a[data-testid="up-tree"][aria-label="Parent directory"]` and text `..`.
  Real entries start at `folder-row-1`.
- Folder README (if any) renders below the listing.
- **Native file tree sidebar**: `div#repos-file-tree-sidebar` exists in the SSR markup but its pane
  is hidden for this logged-out request (class contains `HideTree`), and its tree is client-rendered.
  The embedded JSON still carries `codeViewFileTreeLayoutRoute.fileTree` with listings for the current
  folder and every ancestor [S3] (see data doc).
- `[data-testid="copilot-code-view-side-panel"]` is present (hidden) on folder pages [S2].

## 5. Recommended selectors (with fallbacks)

| Purpose | Primary | Fallbacks |
|---|---|---|
| Code-view page gate | `react-app[app-name="code-view"]` | `meta[name="route-controller"][content="files"]` + URL shape (root or `/tree/`) |
| Listing container | `[data-testid="directory-content"]` | `table[aria-labelledby="folders-and-files"]`; `#folders-and-files` + next sibling |
| Listing rows | `[data-testid="directory-content"] tbody > tr.react-directory-row` | `tr[id^="folder-row-"]` excluding the `up-tree` row |
| Folder vs file | `a[aria-label$=", (Directory)"]` in the row | `svg.octicon-file-directory-fill`; `a[href*="/tree/"]` |
| Name link | `.react-directory-filename-cell a` (refined-github uses this, [S4]) | `.react-directory-truncate a` |
| Parent row (skip) | `a[data-testid="up-tree"]` | `tr:not(.react-directory-row)` |
| Latest-commit bar | `[data-testid="latest-commit-details"]` -> nearest bordered ancestor | sr-only `h2` with text "Latest commit" |
| Branch picker | `#ref-picker-repos-header-ref-selector`, `#ref-picker-repos-header-ref-selector-wide` | `button[aria-label$=" branch"][data-testid="anchor-button"]` |

Rules [inference]: prefer `data-testid`, ids and aria attributes; accept `react-directory-*` classes
(they are hand-written, unhashed, and have been stable enough that refined-github relies on them
[S4]); never use hashed `Box_*__xxxx` / `prc-*-<hash>` classes; match text only as a last resort
(localization is not an issue on github.com today, but labels do change).

## 6. Styles and CSP

- [observed] github.com CSP: `style-src 'unsafe-inline' github.githubassets.com`;
  `script-src github.githubassets.com 'sha256-...'` (no `unsafe-inline`); `connect-src 'self' ... api.github.com ...`;
  `img-src 'self' data: blob: ...` [S1 response headers].
- [claimed] Chrome isolated-world content scripts run under the extension's CSP, not the page's; the
  page CSP applies only to code injected into the main world [S14]. Chrome exempts DOM created by
  isolated content scripts from page CSP [S13].
- [claimed] Firefox still applies page CSP to some content inserted by content scripts; the meta bug
  is open [S12][S13].
- [observed in source] refined-github adds styles via `document.adoptedStyleSheets`, falling back to a
  `<style>` element because "Firefox <153 denies content scripts access to adoptedStyleSheets" [S4].
- Consequence [inference]: declare CSS in the manifest `content_scripts[].css` (or `scripting.insertCSS`),
  which bypasses page CSP in both browsers; inline `<style>` would also pass today because GitHub allows
  `'unsafe-inline'` styles, but that is GitHub's choice and could change. Never inject `<script>` into
  the page (blocked by `script-src`). Inline SVG for the arrow icon is fine (it is DOM, not a script or
  external image).

## 7. Logged-in vs logged-out

- Observed: logged-out only. No credentials were used.
- [claimed, S9] The new code view, including the file tree, has served anonymous users since 2023-07-06.
- [inference, unverified] Logged-in users may see the file tree sidebar expanded by preference
  (`treeExpanded` in the payload), extra header actions, and different About/sidebar partials
  (refined-github targets `rails-partial[data-partial-name="codeViewRepoRoute.Sidebar"]`, which did not
  appear in the logged-out HTML [S4][S1]). The listing table itself is expected to be the same.

## 8. DOM churn history and risk signals

- 2023-02 beta, 2023-05-08 GA of the new React code view [S8]; React was chosen to "iterate more
  quickly on the user interface" [S7] (i.e. frequent UI change is an explicit goal).
- 2023-07 overview redesign beta [S11]; 2023-12-06 overview gained "Go to file" and README tabs [S10].
- refined-github's selector file carries dated TODOs to drop legacy selectors (e.g.
  `TODO [2027-01-01]: Drop '[data-hotkey="w"]'`) and keeps both pre-React and React variants
  (`datetime` vs `title` attribute) [S4]: evidence of repeated markup migrations.
- Current markup shows a build-time CSS-module migration in progress (hashed `Box_N__hash` classes,
  stray `tmp-` utility prefixes) [S1].

## Open questions / risks

1. Logged-in markup not observed; verify the table, header row and sidebar in a real logged-in
   browser (and with the file-tree sidebar open) before freezing selectors.
2. Exact aria-label suffixes for submodule and symlink rows were not captured in HTML (only JSON
   types); capture them from `rust-lang/rust/tree/main/src/tools` and `git/git` in a browser.
3. Directories over 1,000 entries (JSON caps `items` at 1,000, `totalCount` 8,582 for
   DefinitelyTyped `types` [S3]); how the table renders the overflow notice was not inspected.
4. React re-renders rows when deferred commit info arrives and on every in-app navigation; any nodes
   injected into React-owned `tr`/`td` may be removed or may confuse reconciliation. Prefer adding
   sibling rows the extension owns, toggling a class on an ancestor, and re-applying idempotently
   from a MutationObserver.
5. Hydration: modifying SSR DOM before React hydrates can cause a hydration mismatch and a full
   client re-render. Inject after hydration (e.g. `document_idle` plus observer), not at `document_start`.
6. Duplicate name cells (small-screen and large-screen) mean arrows must be added to both or placed
   in a cell the extension controls.
7. The root header row has no stable hook; anchoring on the branch-picker id is the least bad option.
