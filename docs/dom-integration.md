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

## 2. Selector table (observed 2026-11-15, verified against the fixtures 2026-11-16)

Implemented in `src/github/selectors.ts` (T-GNR-101), which the table must match exactly. "Rows",
"parent row", "name link" and "name cells" are queried inside the listing container or a row.

| Purpose                            | Primary                                                                                                                                                   | Fallbacks                                                                                                                                                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code-view page gate                | `react-app[app-name="code-view"]`                                                                                                                         | `meta[name="route-controller"][content="files"]`, counted only with a listing-shaped URL (`/<o>/<r>` or `/<o>/<r>/tree/...`)                                                                                                |
| Listing container                  | `[data-testid="directory-content"]`                                                                                                                       | `table[aria-labelledby="folders-and-files"]`                                                                                                                                                                                |
| Listing rows                       | `tbody > tr.react-directory-row`                                                                                                                          | `tr[id^="folder-row-"]`, minus the parent row (excluded in code)                                                                                                                                                            |
| Parent-directory row (skip)        | `a[data-testid="up-tree"]` (its row is skipped)                                                                                                           | `a[aria-label="Parent directory"]`: a positive mark. Hooks defined by absence (`tr:not(.react-directory-row)`) also match the root's "View all files" row, or every entry once GitHub drops that class                      |
| Folder vs file                     | the row link's `aria-label` ends with `, (Directory)`                                                                                                     | only when the link has no `aria-label` suffix at all: `svg.octicon-file-directory-fill` **and** a link under this repo's `/<o>/<r>/tree/` (§2.2)                                                                            |
| Breadcrumb path (folder layout)    | `[data-testid="breadcrumbs"]`: `ol > li > a` links (the first is `[data-testid="breadcrumbs-repo-link"]`), then `[data-testid="breadcrumbs-filename"] h1` | nav: `#repos-header-breadcrumb`, `#sticky-breadcrumb`; repo link: `ol > li:first-child > a`; name: `h1#file-name-id`, `h1#sticky-file-name-id`. All exist only on folder pages. On a miss `path` and `ref` stay `null` (§3) |
| Name cells (there are two per row) | `td.react-directory-row-name-cell-small-screen`, `td.react-directory-row-name-cell-large-screen`                                                          | `.react-directory-filename-column`                                                                                                                                                                                          |
| Name link                          | `.react-directory-filename-cell a`                                                                                                                        | `.react-directory-truncate a`                                                                                                                                                                                               |
| Header line (latest-commit bar)    | `[data-testid="latest-commit-details"]`; the inner row is the child of its nearest `.border` ancestor (Primer's utility class) that contains it           | `h2[data-testid="screen-reader-heading"]`, then `h2.sr-only`, with the text "Latest commit"; its parent is the same inner row                                                                                               |
| "View all files" row               | `tr[data-testid="view-all-files-row"]`                                                                                                                    | --                                                                                                                                                                                                                          |
| Link (navigation pre-hide)         | `a[href]`, used with `closest()` from a click target                                                                                                      | --                                                                                                                                                                                                                          |
| The extension's own toggle         | `[data-gnr="toggle"]`                                                                                                                                     | --                                                                                                                                                                                                                          |

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
  path: string | null; // '' for the root; null when the folder breadcrumb cannot be read
  layout: 'root' | 'folder';
}
```

Refs may contain `/` (`feature/x`), so the ref is never cut out of the URL. It is resolved like this:

1. **Path.** On the root layout (no `up-tree` row) the path is `''`. On the folder layout it is the
   breadcrumb's segments after `breadcrumbs-repo-link`, ending with `breadcrumbs-filename`, joined
   with `/` (§2).
2. **Reference row.** The first listing row that is a folder (by its `, (Directory)` suffix, or by
   the §2.2 folder fallback when GitHub drops the suffixes) or a file (by its `, (File)` suffix only),
   and whose `href` starts with this repository's `/<o>/<r>/tree/` or `/<o>/<r>/blob/`. There is no
   suffix-less file fallback: file symlinks such as `RelNotes` also link under `/blob/`, so without
   the suffix a file cannot be told from one (#11). Submodule rows, which link to
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
   state (the `html[data-gnr-collapsed]` marker for `collapsed`, nothing for `expanded`), then removes
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
   - the Navigation API `navigatesuccess` event, or `popstate` where that API is absent. **Firefox
     finding (maintainer, 2026-11-16, T-GNR-106):** `navigatesuccess` does **not** reach the content
     script in Firefox. A folder click there delivered `turbo:load`, `wxt:locationchange` (WXT
     namespaces it as `<extension id>:content:wxt:locationchange`) and `soft-nav:end`. So the
     Navigation API is a Chromium-only supplement, and the GitHub and WXT events carry Firefox.
   - WXT's `wxt:locationchange`

   Calls are debounced to one per animation frame. The script reads only event names, never event
   payloads, because payloads from the page's world are not reliably readable from the isolated world.
   **In-page navigation pre-hide.** Without it, a new listing rendered visible and collapsed one or two
   frames later (seen in Firefox by the maintainer, and measured with `tests/e2e/manual/flash-probe.mjs`).
   So `data-gnr-pending` is also set, synchronously, when an in-page navigation toward a
   **different listing** starts:
   - on a plain left click on a same-site link to a listing-shaped URL, from a capture-phase listener
     that runs before GitHub's router (modified clicks, `target` other than `_self`, `download` links
     and the listing already shown are ignored);
   - on `popstate` (back and forward), where `location` already holds the destination.

   It ends like the cold-load pre-hide: the apply that installs the toggle clears it, and so does
   the non-listing exit. The no-listing exit **keeps** it mid-navigation: the old listing is gone
   and the new one not yet rendered, so nothing visible is hidden. So does the no-header exit
   mid-navigation: the header line may not have rendered yet, and showing the files there recorded
   them as shown, which kept a root expanded after `/tree/<ref>` to `/<o>/<r>` (#17). It observes the code-view
   app for the arrival, because clearing pending there flashed the new listing for a frame. A
   per-navigation watchdog (4 seconds; only the latest navigation's acts) always ends it. An apply
   on the **outgoing** listing (the one shown when the navigation started), a re-render before the
   URL changes, does not end it early. A successful apply on any other listing does, including a
   destination GitHub redirected or canonicalized (a `/tree/master/docs` link landing on
   `/tree/main/docs`), so its toggle works at once (#17). Three ways back to the outgoing listing
   end it at once too, but only while that listing's toggle still works (installed by an apply on it
   **and** still in the DOM): Back before the destination renders (#19), a click on a link to the
   listing still shown, and a completion signal (`soft-nav:end` or `turbo:load`; not
   `navigatesuccess`, which Chromium fires for any `pushState`/`replaceState`, including a router's
   own on the outgoing URL)
   that arrives with `location` back on it, which is where a link redirecting to the page already
   shown ends up (#17). A start signal (`wxt:locationchange`) does not count. When the return
   comes before a working toggle exists (React replaced the commit bar and the apply that installs
   a new one is a frame away), the outgoing listing stops counting as outgoing, so that next
   successful apply ends the pre-hide (#20). The cold-load watchdog
   never ends a navigation's pre-hide: a folder click about 4 s after load lost its pre-hide to that
   timer, which flashed the new listing for a frame. If no working toggle exists for the listing
   actually shown (installed by an apply on it, in the DOM, and with the listing present), the
   watchdog also removes the collapsed marker. A watchdog whose navigation already ended does
   nothing (#20). When the navigation stalled (the URL moved on but the destination never rendered),
   the outgoing listing is what becomes visible (still in the same container node). It is recorded
   as shown, and a toggle still in place is set to expanded, so it says what is shown and coming
   Back does not collapse it, whether or not its toggle was still installed (#20, #21). "Installed" alone is not enough:
   mid-navigation React may already have removed the header line and the toggle with it (agy,
   post-merge review of #19). An aborted navigation leaves the old URL, and its toggle keeps
   working.

   **The collapsed marker is on `<html>` (`data-gnr-collapsed`), not on the listing container.**
   Measured live: React replaced the container about 400 ms after the first apply, during hydration,
   with `class=""`, which dropped a class there and flashed the listing for one frame. A marker on
   `<html>` hides any container until the next apply puts the toggle back. Every path that ends with
   no toggle removes the marker: the no-header exit outside a navigation (mid-navigation it keeps the
   pre-hide instead, see above), the non-listing exit, budget exhaustion, the
   navigation watchdog, teardown, an exception inside `apply()` (the toggle counts as installed only
   once it is in the DOM), and a no-listing exit that is not part of a click or `popstate`
   navigation, such as a keyboard-shortcut navigation or React unmounting the listing. The
   no-header, non-listing and (outside a navigation) no-listing exits also remove the extension's own
   toggles, so no inert button stays
   behind in a DOM React keeps (#17).

   **The first signals arrive before the new listing renders** (observed live,
   `ref-docs/research-update-2026-11-16-phase1-fixtures.md` §6). So after a navigation, `apply()`
   first checks that the listing in the DOM belongs to the new URL. When the first entry row's href
   equals the previous page's **and the listing container is the same node**, the DOM is stale:
   `apply()` does nothing and waits for the next signal. React renders the destination into a new
   container, even when its rows are identical (`/<o>/<r>` and `/<o>/<r>/tree/main`; measured live,
   `ref-docs/research-update-2026-11-21-listing-node-identity.md`). A resolved ref is not taken as
   proof that the DOM is current: a bare `/<o>/<r>` URL accepts any ref in the cross-check, so the
   outgoing `/tree/<ref>` page passed it and ended the navigation early (#20). The rows and the
   container are recorded only when a listing is present, so a brief unmount that happens before
   the URL changes keeps the outgoing node's identity (#23). An unmount after the URL has changed
   still starts the destination's state (as before #23). An outgoing listing re-attached then is
   applied once as the destination: the pre-hide ends early while the collapsed marker keeps it
   hidden, and the user's choice for the outgoing listing is lost. Its node is then recorded under
   the destination, so going Back to the outgoing listing reads its own DOM as stale: hidden up to
   the 4-second watchdog, then shown without a toggle until the next navigation. Accepted
   limitation (#24): two attempts to keep the outgoing state across that unmount each opened new
   edge cases, and the worst case leaves the files visible. Implemented in
   `src/features/collapse.ts`.

   An `apply()` after a navigation to a **different listing** resets both levels. A different
   listing means `location.pathname` changed since the last apply, compared as a whole string. Level
   1 returns to the default state, or to the remembered per-repo state if that setting is on, and
   Level 2 starts with every folder collapsed. An `apply()` on the **same listing**, after a React
   re-render, keeps both levels' state (`docs/architecture.md` §3.2).

5. **React re-render.** A scoped MutationObserver on the nearest common ancestor of the listing
   container and the header line's box, watching `childList` with `subtree`, schedules `apply()`
   when GitHub replaces rows, the listing or the commit bar (and so the toggle). This happens when
   deferred commit info fills in after first paint. Budget: the callback does no layout reads and
   stops after at most 50 runs per listing. The controller drops the records of its own toggle
   insertion (`takeRecords()`), so it does not trigger itself. When the budget runs out, nothing would
   notice the toggle vanishing any more. So the page is **restored** (toggle removed, files shown) and
   that listing is left as GitHub renders it until the next navigation to a different listing; an
   apply on it also ends any navigation pre-hide (#20). After
   a no-header exit the observer watches the code-view app instead, which contains both the listing
   and the commit bar on either layout, so a late commit bar is picked up.

   **No late collapse.** If the first `apply()` on a listing shows it uncollapsed (for example, the
   header line was not yet rendered and `data-gnr-pending` was cleared), a later `apply()` on the
   same listing may insert the toggle but leaves the listing **expanded**. Collapsing a listing the
   user can already see would move content under their pointer. The default state applies again on
   the next navigation to a different listing. Exposure is recorded wherever the files become
   visible without a toggle: the no-header exit, a cold-load no-listing exit (the listing renders
   visible later), and either watchdog ending a pre-hide with no working toggle, including before
   any state exists for the listing (#17). An exposure belongs to one visit: it is dropped when a navigation pre-hide
   starts, when a navigation returns to the outgoing listing, unless the exposure is that listing's own
   (#23, #24), and by any apply that is not stale, after the state for its listing has consumed it (#20,
   #21). A mid-navigation no-listing or no-header exit also carries the user's choice, so an aborted
   navigation brings the outgoing listing back as it was (#21). A listing that React unmounts briefly, outside a
   navigation, keeps the user's own choice when it returns instead (#17); the choice is carried once, so further applies while it is absent change nothing (#20).

   **One navigation watcher.** `startLifecycle` registers the only `watchNavigation`; the content
   script's logging attaches through its hooks (`onNavigation`, `onSignal`) instead of registering a
   second watcher (#17). The click listener ignores a link whose `href` does not parse.

6. **Teardown.** WXT's `ctx.onInvalidated` disconnects observers and removes listeners when the
   extension updates or reloads. It also **restores the page**: the extension's toggles are removed,
   the collapsed marker and `data-gnr-pending` are cleared. A dead content script would otherwise
   leave the files hidden behind a button that no longer responds (verified live: after an extension
   reload the listing is visible and usable).

The controller also forgets the listing whenever an `apply()` lands on a non-listing page. Returning
to the same listing later (Issues, then Back) is a navigation, not a re-render, so it starts
collapsed again. If the header line disappears after a successful collapse, the next `apply()` takes
the no-header exit. Outside a navigation, that exit removes the collapsed marker, so files are never
hidden without a toggle, and marks the listing as shown, so a header that returns does not cause a
late collapse. Mid-navigation it keeps the pre-hide, bounded by the navigation watchdog, which shows
the files and records them as shown if no header line arrives.

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
- All selectors are prefixed with `[data-gnr]`, the `gnr-` class prefix, `html[data-gnr-pending]` or
  `html[data-gnr-collapsed]`.
- Colors come only from Primer CSS variables (`docs/ui-behavior.md` §4).

## 6. Breakage detection

- `src/github/probe.ts` exports `probe()`, which reports which rank of each selector matched (it uses
  the same header-line lookup as the controller, `src/github/header.ts`). With
  `debug.logging` on, the content script logs `[gnr] probe: codeView=primary listing=primary ...` once
  per page. Until that setting exists (T-GNR-301), the line is logged at `console.debug` level, which
  DevTools hides by default.
- The fixture test suite (`docs/testing-strategy.md` §3) runs `probe()` against saved pages. A weekly
  scheduled CI job runs it against live public pages and opens an issue when a primary selector stops
  matching.

## 7. Coexistence

| Extension                         | Expected interaction                                      | Rule                                                                                                |
| --------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Refined GitHub                    | Restyles listing rows and adds features on the same pages | Insert only marked nodes; no global styles. Test with Refined GitHub installed before each release. |
| Octotree, Gitako                  | Sidebar trees; they don't touch the listing table         | None needed.                                                                                        |
| GitHub's native file-tree sidebar | Independent                                               | None needed. Never toggle it.                                                                       |
