# DOM Integration Specification

**Status:** Draft v0.1 (2026-11-15) | **Tickets:** Phase 1 (all), Phase 3 Sprint 2
**Sources:** `ref-docs/github-code-view-dom.md` (selectors, both layouts),
`ref-docs/github-navigation-events.md` (soft navigation), `ref-docs/research-report.md` §2

GitHub's markup is not an API. This document fixes **how** the extension finds and changes it, so that a
GitHub deploy degrades the extension to doing nothing, never to a broken page.

## 1. Principles

1. **Selectors live in one file.** All selectors are in `src/github/selectors.ts`, ranked
   primary-first. No other module contains a selector string.
2. **Stable hooks only.** Use, in order of preference:
   - `data-testid` attributes
   - ids
   - ARIA attributes
   - hand-written `react-directory-*` classes
   - text, as a last resort

   Never use hashed CSS-module classes such as `Box_3__eg9tXU`, `prc-Button-ButtonBase-9n-Xk` or
   `OverviewTable__*`; they change per deploy. Source: `ref-docs/github-code-view-dom.md` §2, §5.

3. **Add, don't mutate.** The extension inserts its own nodes, marked `data-gnr="..."`, and toggles
   classes on its own nodes and on the listing container. It never removes, reorders or rewrites
   GitHub's nodes, and never edits GitHub's text.
4. **Idempotent apply.** `apply()` can run any number of times on any page state. Each run checks for
   its own marker and does only the missing work.
5. **Confidence gate.** If the primary and all fallback selectors for the listing or its header fail,
   log once (under `debug.logging`) and leave the page alone. Leaving it alone includes removing
   `data-gnr-pending` at once (§4), so the listing is never left hidden.

## 2. Selector table (initial, from 2026-11-15 observations)

| Purpose                            | Primary                                                                                          | Fallbacks                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Code-view page gate                | `react-app[app-name="code-view"]`                                                                | URL shape (`/<o>/<r>` or `/<o>/<r>/tree/...`) and `meta[name="route-controller"][content="files"]`                                               |
| Listing container                  | `[data-testid="directory-content"]`                                                              | `table[aria-labelledby="folders-and-files"]`                                                                                                     |
| Listing rows                       | `[data-testid="directory-content"] tbody > tr.react-directory-row`                               | `tr[id^="folder-row-"]` except the parent row                                                                                                    |
| Parent-directory row (skip)        | `a[data-testid="up-tree"]`                                                                       | `tr:not(.react-directory-row)` in `tbody`                                                                                                        |
| Folder vs file                     | the row link's `aria-label` ends with `, (Directory)`                                            | only when the link has no `aria-label` suffix at all: `svg.octicon-file-directory-fill` **and** a link under this repo's `/<o>/<r>/tree/` (§2.2) |
| Breadcrumb path (folder layout)    | `[data-testid="breadcrumbs"]`, its `breadcrumbs-repo-link` and `breadcrumbs-filename` entries    | --; on a miss the ref stays unresolved (§3)                                                                                                      |
| Name cells (there are two per row) | `td.react-directory-row-name-cell-small-screen`, `td.react-directory-row-name-cell-large-screen` | `.react-directory-filename-column`                                                                                                               |
| Name link                          | `.react-directory-filename-cell a`                                                               | `.react-directory-truncate a`                                                                                                                    |
| Header line (latest-commit bar)    | `[data-testid="latest-commit-details"]`, then its nearest bordered box ancestor                  | sr-only `h2` with text "Latest commit"                                                                                                           |
| "View all files" row               | `tr[data-testid="view-all-files-row"]`                                                           | --                                                                                                                                               |

### 2.1 The header line

The concept calls for collapsing the listing to "a single line (the header)".

On both layouts, the line directly above the rows that belongs to the listing is the **latest-commit
bar** (author, message, short sha, "N Commits" history link):

- On the repository root it shares a box with the table.
- On folder pages it is a separate box directly above the table.

So:

- **Toggle location:** the arrow is inserted as the first child of the latest-commit bar's inner row.
- **What collapses:** `[data-testid="directory-content"]`, the table plus the "View all files" row.
- **What stays:** the branch-picker row above, the commit bar, and the README.

The toggle needs a visible line to live in. The branch-picker row on the root page has no stable hook
of its own (`ref-docs/github-code-view-dom.md` §3), so it is not used.

An optional Phase 3 setting ("compact header") also hides the commit bar's text and keeps only the
arrow and "N items". See `docs/settings.md`.

### 2.2 Rows

- Each row has **two** name cells, small-screen and large-screen; CSS shows one. The folder arrow is
  inserted into both, so the feature works at every viewport width.
- Folder pages start with a parent-directory row (`..`), which gets no arrow.
- A row whose link `title` reads "This path skips through empty directories" is a simplified chain.
  Expanding it expands the deepest folder, which is the row link's `href`.
- Submodule rows (link to another repository) and symlink rows (`aria-label` ends `(Symlink to file)`)
  get no arrow. Observed link suffixes are `(Directory)`, `(File)`, `(Submodule)` and
  `(Symlink to file)`. **Only `(Directory)` gets an arrow**, so a suffix GitHub adds later, such as
  the not yet observed suffix of a directory symlink, is safely ignored. The primary check is what
  excludes submodules and symlinks.
- **The folder fallback is fail-safe.** It applies only to a row link with no `aria-label` suffix,
  and it needs both the directory icon and an `href` that starts with this repository's
  `/<o>/<r>/tree/`. The prefix is compared in code from the page's owner and repo, not written as a
  selector. A bare `a[href*="/tree/"]` is not enough: submodule links point at another repository's
  `/tree/`, and a directory symlink may link under this one. Any row the fallback cannot classify
  with certainty is treated as non-expandable.
- **The server renders at most 100 rows.** The embedded JSON carries every entry; on larger folders
  React presumably adds the rest after hydration. `apply()` must decorate rows that appear after
  the first pass (§4, step 5).
- **The "View all files" row is mobile-only truncation** (`show-for-mobile` / `truncate-for-mobile`),
  not the 100-row limit.
- **Signed in or out makes no difference.** Every selector in the table above matches the same
  elements on both layouts. See `ref-docs/research-update-2026-11-16-logged-in-dom.md` and
  `pnpm fixtures:report`.
- **Don't use branch-picker ids to tell layouts apart.** Folder pages carry both the root id and the
  `-wide` id. Use the `up-tree` row or the URL.

## 3. Page model

`src/github/page.ts` produces, from the DOM and never from URL splitting alone:

```ts
interface ListingPage {
  owner: string;
  repo: string;
  ref: string | null; // from a row href by subtraction, NOT url.split('/'); null if unresolved
  path: string; // '' for the root
  layout: 'root' | 'folder';
}
```

Refs may contain `/` (`feature/x`), so the ref is never cut out of the URL. It is resolved like this:

1. **Path.** On the root layout (no `up-tree` row) the path is `''`. On the folder layout it is the
   breadcrumb's segments after `breadcrumbs-repo-link`, ending with `breadcrumbs-filename`, joined
   with `/` (§2).
2. **Reference row.** The first listing row that §2.2 classifies as a folder or a file (by its
   `aria-label` suffix, or by the §2.2 fallback when GitHub drops the suffixes), and whose `href`
   starts with this repository's `/<o>/<r>/tree/` or `/<o>/<r>/blob/`. Submodule rows, which link to
   another repository, and symlink rows are skipped. A simplified-chain row (`a/b/c`) is used only
   when no other row qualifies; its `<name>` is then the chain's full displayed path. Without that,
   a folder holding only chains (`src/` with only `main/java/...` and `test/java/...`) would never
   resolve its ref.
3. **Subtraction.** The row's decoded `href` is `/<o>/<r>/(tree|blob)/<ref>/<path>/<name>` (with no
   `<path>/` at the root). Removing the known prefix, `<path>` and the link's `<name>` from the two
   ends leaves `<ref>`, which must be non-empty.
4. **Cross-check.** The decoded `location.pathname`, with any trailing `/` removed (as `detectPage`
   accepts it), must equal `/<o>/<r>/tree/<ref>/<path>`, or on the root `/<o>/<r>` or
   `/<o>/<r>/tree/<ref>`. This is a whole-string comparison, not a split, and it catches rows left
   over from the previous page after a soft navigation.

If any step fails, `ref` is `null`. Level 1 does not need the ref, so the collapse still works. Level
2 adds no folder arrows on that page and logs the reason under `debug.logging`. An empty listing has
no rows to expand, so its ref is never needed.

The embedded `react-app.embeddedData` JSON also carries `refInfo.name` and `path`, but it reflects the
initial document only and goes stale after a soft navigation, so it is not used
(`ref-docs/github-data-sources.md` §1, `ref-docs/research-report.md` §3).

## 4. Lifecycle and soft navigation

GitHub switches pages without reloads using both Turbo and a React router, wrapped in its own
`soft-nav:*` events on `document` (`ref-docs/github-navigation-events.md` §1-§2). Declared content
scripts run only on full loads.

1. The content script matches all of `https://github.com/*`, so it is present whatever page the user
   enters on.
2. **`document_start`.** If the URL has a listing shape (`/<o>/<r>` or `/<o>/<r>/tree/...`), the
   script adds `data-gnr-pending` to `<html>` and starts a 4-second watchdog. It also starts reading
   the Level 1 settings (Phase 3, `docs/settings.md`). The manifest CSS hides listing rows only under
   `html[data-gnr-pending]` or a collapsed container. This prevents a flash of the full listing before
   the toggle exists.

   **The pre-hide is the one exception to "never hide the listing without a toggle".** It is bounded:
   `data-gnr-pending` is removed by whichever comes first of
   - a successful first apply, after the toggle is inserted
   - any `apply()` exit that does not install the toggle (below)
   - the watchdog, after 4 seconds. If it fires, the page shows GitHub's normal listing; this is the
     failure rule in `docs/ui-behavior.md` §2.3.

3. **First apply.** When the listing appears (detected by a MutationObserver on `document`, which is
   disconnected after the first match), the script runs `apply()`. It also runs once at
   `DOMContentLoaded`. The listing is server-rendered, so a page with no listing by then takes the
   non-listing exit. `apply()` waits for the settings read, inserts the toggle, applies the resolved
   state (the collapsed class for `collapsed`, nothing for `expanded`), then removes
   `data-gnr-pending`.

   Every exit path of `apply()` that does not install the toggle removes `data-gnr-pending`
   immediately, not at the watchdog. Those paths are:
   - the page is not a listing page (detector returns `null`)
   - the confidence gate fails (§1.5), for the listing or for the header line
   - any selector the toggle needs misses
   - an unexpected exception inside `apply()`

   When the resolved Level 1 state is `expanded`, the pending attribute is cleared as soon as the
   setting is known. The rows are still hidden for the length of the storage read on such a page.
   That read is normally a few milliseconds, and the watchdog bounds it.

4. **Soft navigation triggers.** `apply()` also runs after:
   - `soft-nav:end`
   - `soft-nav:react-done`
   - `turbo:render`
   - `turbo:load`
   - the Navigation API `navigatesuccess` event, or `popstate` where that API is absent
   - WXT's `wxt:locationchange`

   Calls are debounced to one per animation frame. The script reads only event names, never event
   payloads, because payloads from the page's world are not reliably readable from the isolated world.
   Soft navigation never sets `data-gnr-pending`. If it is still set when a soft navigation reaches a
   non-listing page, that `apply()` takes the non-listing exit and removes it.

   An `apply()` after a navigation to a **different listing** resets both levels. A different
   listing means `location.pathname` changed since the last apply, compared as a whole string. Level
   1 returns to the default state, or to the remembered per-repo state if that setting is on, and
   Level 2 starts with every folder collapsed. An `apply()` on the **same listing**, after a React
   re-render, keeps both levels' state (`docs/architecture.md` §3.2).

5. **React re-render.** A scoped MutationObserver on the listing container, watching `childList` with
   `subtree`, re-runs the cheap part of `apply()` when GitHub replaces rows. This happens when deferred
   commit info fills in after first paint. Budget: the callback does no layout reads and stops after
   at most 50 runs per page.

   **No late collapse.** If the first `apply()` on a listing shows it uncollapsed (for example, the
   header line was not yet rendered and `data-gnr-pending` was cleared), a later `apply()` on the
   same listing may insert the toggle but leaves the listing **expanded**. Collapsing a listing the
   user can already see would move content under their pointer. The default state applies again on
   the next navigation to a different listing.

6. **Teardown.** WXT's `ctx.onInvalidated` disconnects observers and removes listeners when the
   extension updates or reloads.

### Hydration

GitHub server-renders the listing and then hydrates it with React. Changing nodes before hydration
risks a hydration mismatch and a full client re-render.

The extension's own nodes are inserted as **siblings or children that React does not own**:

- the arrow button, placed before the icon in the name cell
- inline child rows, inserted as extra `<tr data-gnr-row>` after a folder row

Re-render is handled by step 5. If a re-render removes the arrow, the next apply puts it back.

Inline child rows may be dropped when React re-renders `tbody`. The tree controller keeps expansion
state in memory, keyed by path, and re-inserts expanded subtrees on the next apply.

## 5. Styles

- One stylesheet, `src/entrypoints/content/style.css`, injected through the manifest `content_scripts.css`
  so page CSP is not involved. No inline `style` attributes; behaviour is driven by classes. GitHub's
  CSP allows inline styles, but Firefox still applies page CSP to some content-script DOM (Mozilla bug
  1267027). See `ref-docs/github-code-view-dom.md` §6.
- All selectors are prefixed with `[data-gnr]`, the `gnr-` class prefix, or `html[data-gnr-pending]`.
- Colors come only from Primer CSS variables (`docs/ui-behavior.md` §4).

## 6. Breakage detection

- `src/github/selectors.ts` exports `probe()`, which reports which rank of each selector matched. With
  `debug.logging` on, the content script logs `[gnr] probe: listing=primary rows=fallback1 ...` once
  per page.
- The fixture test suite (`docs/testing-strategy.md` §3) runs `probe()` against saved pages. A weekly
  scheduled CI job runs it against live public pages and opens an issue when a primary selector stops
  matching.

## 7. Coexistence

| Extension                         | Expected interaction                                      | Rule                                                                                                |
| --------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Refined GitHub                    | Restyles listing rows and adds features on the same pages | Insert only marked nodes; no global styles. Test with Refined GitHub installed before each release. |
| Octotree, Gitako                  | Sidebar trees; they don't touch the listing table         | None needed.                                                                                        |
| GitHub's native file-tree sidebar | Independent                                               | None needed. Never toggle it.                                                                       |
