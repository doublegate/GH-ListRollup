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
   log once (under `debug.logging`) and leave the page alone.

## 2. Selector table (initial, from 2026-11-15 observations)

| Purpose                            | Primary                                                                                          | Fallbacks                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Code-view page gate                | `react-app[app-name="code-view"]`                                                                | URL shape (`/<o>/<r>` or `/<o>/<r>/tree/...`) and `meta[name="route-controller"][content="files"]` |
| Listing container                  | `[data-testid="directory-content"]`                                                              | `table[aria-labelledby="folders-and-files"]`                                                       |
| Listing rows                       | `[data-testid="directory-content"] tbody > tr.react-directory-row`                               | `tr[id^="folder-row-"]` except the parent row                                                      |
| Parent-directory row (skip)        | `a[data-testid="up-tree"]`                                                                       | `tr:not(.react-directory-row)` in `tbody`                                                          |
| Folder vs file                     | the row link's `aria-label` ends with `, (Directory)`                                            | `svg.octicon-file-directory-fill`; `a[href*="/tree/"]`                                             |
| Name cells (there are two per row) | `td.react-directory-row-name-cell-small-screen`, `td.react-directory-row-name-cell-large-screen` | `.react-directory-filename-column`                                                                 |
| Name link                          | `.react-directory-filename-cell a`                                                               | `.react-directory-truncate a`                                                                      |
| Header line (latest-commit bar)    | `[data-testid="latest-commit-details"]`, then its nearest bordered box ancestor                  | sr-only `h2` with text "Latest commit"                                                             |
| "View all files" row               | `tr[data-testid="view-all-files-row"]`                                                           | --                                                                                                 |

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
  `(Symlink to file)`. **Only `(Directory)` gets an arrow**, so a suffix GitHub adds later is
  safely ignored.
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
  ref: string; // from the row hrefs or the tree JSON refInfo, NOT url.split('/')
  path: string; // '' for the root
  layout: 'root' | 'folder';
}
```

Refs may contain `/` (`feature/x`). The reliable source is the first folder or file row's `href`:
`/<o>/<r>/tree/<ref>/<path>/<name>`. The known `<name>` and the current `<path>` from the breadcrumb
give `<ref>` by subtraction. When a listing has no rows, ref resolution waits for the first fetch, which
returns `refInfo.name` (`ref-docs/github-data-sources.md` §2).

## 4. Lifecycle and soft navigation

GitHub switches pages without reloads using both Turbo and a React router, wrapped in its own
`soft-nav:*` events on `document` (`ref-docs/github-navigation-events.md` §1-§2). Declared content
scripts run only on full loads.

1. The content script matches all of `https://github.com/*`, so it is present whatever page the user
   enters on.
2. **`document_start`.** The script adds `data-gnr-pending` to `<html>` and starts a 4-second
   watchdog. The manifest CSS hides listing rows only under `html[data-gnr-pending]` or a collapsed
   container. This prevents a flash of the full listing before the toggle exists.
3. **First apply.** When the listing appears (detected by a MutationObserver on `document`, which is
   disconnected after the first match), the script runs `apply()`. `apply()` inserts the toggle, sets
   the container's collapsed class, then removes `data-gnr-pending`. If the watchdog fires first, it
   removes `data-gnr-pending` and the page shows GitHub's normal listing. This is the failure rule in
   `docs/ui-behavior.md` §2.3.
4. **Soft navigation triggers.** `apply()` also runs after:
   - `soft-nav:end`
   - `soft-nav:react-done`
   - `turbo:render`
   - `turbo:load`
   - the Navigation API `navigatesuccess` event, or `popstate` where that API is absent
   - WXT's `wxt:locationchange`

   Calls are debounced to one per animation frame. The script reads only event names, never event
   payloads, because payloads from the page's world are not reliably readable from the isolated world.

5. **React re-render.** A scoped MutationObserver on the listing container, watching `childList` with
   `subtree`, re-runs the cheap part of `apply()` when GitHub replaces rows. This happens when deferred
   commit info fills in after first paint. Budget: the callback does no layout reads and stops after
   at most 50 runs per page.
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
