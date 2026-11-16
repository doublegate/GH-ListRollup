# Research update 2026-11-16: Phase 1 fixtures (breadcrumb, commit bar, refs, empty repository)

**Supplements:** `github-code-view-dom.md` §3-§4 (2026-11-15)
**Tickets:** T-GNR-101, T-GNR-103, T-GNR-104
**Evidence:** five new logged-out fixtures in `tests/fixtures/html/`, captured 2026-11-16 by
`scripts/capture-fixture.ts`. Their sources are in `tests/fixtures/manifest.json`:

- `folder-deep` (`git/git/tree/master/contrib/completion`)
- `root-tag` (`git/git/tree/v2.47.0`)
- `root-sha` (`git/git` at a full commit SHA)
- `root-slash-ref` (`refined-github/sandbox/tree/branch/with/slashes`)
- `empty-repo` (`bihealth/dafthelper`, an empty public repository)

## 1. Breadcrumb structure (folder layout)

`docs/dom-integration.md` §3 had inferred the path rule from three testids. The `folder-deep` fixture
shows the actual structure:

```html
<nav data-testid="breadcrumbs">
  <h2>Breadcrumbs</h2>
  <ol>
    <li><a data-testid="breadcrumbs-repo-link" href="/git/git/tree/master">git</a></li>
    <li><span aria-hidden="true">/</span><a href="/git/git/tree/master/contrib">contrib</a></li>
  </ol>
</nav>
<div data-testid="breadcrumbs-filename"><span>/</span><h1>completion</h1><span>/</span></div>
```

- The repository link comes first, and every further `li > a` is one parent folder.
- The current folder is the `h1` in `breadcrumbs-filename`, a separate element after the nav.
- The page renders two breadcrumbs (`repos-header-breadcrumb` and `sticky-breadcrumb`); they hold
  the same content.

So the path is the parent links' text plus the heading, joined with `/`: here `contrib/completion`.

## 2. Commit bar: the inner row and its box

The ancestors of `[data-testid="latest-commit-details"]` are identical on the root and folder pages
up to the bordered box:

1. `latest-commit-details` (empty in the server HTML; the commit text is deferred)
2. a flex wrapper
3. the **inner row**, which also contains the screen-reader `h2[data-testid="screen-reader-heading"]`
   "Latest commit"
4. the **box**, which carries Primer's `border` utility class (plus `rounded-top-2` on the root, where
   it is above the listing in a shared parent, and `rounded-2` on folder pages)

Every class on levels 2 and 3 is a hashed CSS-module class. That is why the locator finds the box
with `.border` and then takes the box's child that contains the details, rather than counting
parents. The sr-only heading's parent is the same inner row, so it is a usable fallback.

## 3. Refs from row links

| Fixture          | URL ref segment(s)        | First row link                                              |
| ---------------- | ------------------------- | ----------------------------------------------------------- |
| `root-tag`       | `v2.47.0`                 | `/git/git/tree/v2.47.0/.github`                             |
| `root-sha`       | the 40-hex SHA            | `/git/git/tree/<sha>/.github`                               |
| `root-slash-ref` | `branch`, `with`, `slashes` | `/refined-github/sandbox/blob/branch/with/slashes/renamed.md` |

The slash-ref root has a single entry, a file, so the ref is resolved from a `/blob/` link. The URL
`/refined-github/sandbox/tree/branch/with/slashes` alone cannot say where the ref ends.

A `/tree/<sha>` URL must use a commit of that same repository. A SHA from another repository's
fixture returned 404.

## 4. Empty repository

`github.com/bihealth/dafthelper` (verified empty through the contents API: "This repository is
empty") serves **no** `react-app[app-name="code-view"]`, no listing, no commit bar and no breadcrumb.
It **does** serve `meta[name="route-controller"][content="files"]`, and its URL has the listing shape.

So the code-view gate passes through its fallback, and the page model is `ref: null` with nothing to
collapse. The confidence gate (`docs/dom-integration.md` §1.5) then leaves the page alone.

## 5. Fallback selectors, checked against every listing fixture

- `table[aria-labelledby="folders-and-files"]`, `.react-directory-truncate a` and
  `.react-directory-filename-column` all match, as the primaries do.
- `tr[id^="folder-row-"]` also matches the parent (`..`) row, which must be excluded in code.
- `tbody > tr:not(.react-directory-row)`, the parent-row fallback the spec first listed, **also
  matches a row on the root page** ("View all files"). It was narrowed to the first body row that is
  neither a normal row nor a testid'd row.

## 6. Live: soft-navigation events fire before the new listing renders

Observed on live `github.com/wxt-dev/wxt` in Playwright's Chromium, 2026-11-16 (the manual
T-GNR-004 run, with the Sprint 1 content script logging the page model at debug level):

| Step | URL after the step | What `readListingPage` read |
| --- | --- | --- |
| Full load | `/wxt-dev/wxt` | `layout=root ref=main path=` (correct) |
| Click folder `packages` | `/wxt-dev/wxt/tree/main/packages` | `layout=root ref=null path=` (the **previous** root DOM) |
| Browser Back | `/wxt-dev/wxt` | `layout=folder ref=null path=packages` (the **previous** folder DOM) |
| Click the Code tab from Issues | `/wxt-dev/wxt` | `listing=none`: nothing rendered yet |

The read happens one animation frame after the first soft-navigation signal (`soft-nav:end`,
`soft-nav:react-done`, `turbo:render`, `turbo:load` or `popstate`). At that point the DOM still
shows the old page, or none.

- The cross-check (`docs/dom-integration.md` §3, step 4) worked as intended: every stale read
  produced `ref: null`, never a wrong ref.
- `layout` and `path`, however, come from the stale DOM.
- So the collapse controller (T-GNR-106) must not act on the first read after a navigation. It has
  to wait, for example with the first-listing observer, until the listing matches the URL.

