# Data Sources for a Folder's Children

Retrieved: 2026-11-15

## Sources

- [S1] Direct observation: embedded payload `script[type="application/json"][data-target="react-app.embeddedData"]` in `https://github.com/microsoft/vscode` and `https://github.com/microsoft/vscode/tree/main/src/vs` (logged out, curl), 2026-11-15.
- [S2] Direct observation: `GET https://github.com/<o>/<r>/tree/<ref>/<path>` with `Accept: application/json` (curl, no cookies) for `microsoft/vscode` `src/vs`, `rust-lang/rust` `src/tools`, `git/git` root, `DefinitelyTyped/DefinitelyTyped` `types`, `refined-github/sandbox` branch `branch/with/slashes`, plus a nonexistent path and repo, 2026-11-15.
- [S3] Direct observation: `GET https://github.com/microsoft/vscode/tree-commit-info/main/src/vs`, `.../latest-commit/main/src/vs` and `.../tree-list/<oid>` with `Accept: application/json`, 2026-11-15.
- [S4] Direct observation: GitHub JS bundles (`core-*.js`, `app-runtime-*.js`, `code-view-*.js`) from `https://github.githubassets.com/assets/`, fetched 2026-11-15: GitHub's own fetch wrapper headers and the `treeCommitInfo` query.
- [S5] Direct observation: `api.github.com` contents and git-trees calls (unauthenticated, `Origin: https://github.com`), response headers, 2026-11-15.
- [S6] GitHub Docs, "REST API endpoints for repository contents": https://docs.github.com/en/rest/repos/contents - directory listing, 1,000-file limit, `ref`, media types.
- [S7] GitHub Docs, "REST API endpoints for Git trees": https://docs.github.com/en/rest/git/trees - `recursive`, 100,000 entries / 7 MB limit, `truncated`.
- [S8] GitHub Docs, "Rate limits for the REST API": https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api - 60/h unauthenticated, 5,000/h authenticated, secondary limits.
- [S9] Chrome for Developers, "Cross-origin network requests": https://developer.chrome.com/docs/extensions/develop/concepts/network-requests - content scripts request "on behalf of the web origin" they are injected into; cross-origin always treated as such.
- [S10] MDN, "Content scripts": https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts - in MV3 (Chrome and Firefox) content-script requests happen in the page context; Firefox 101+ MV3 content scripts follow the page's CORS policy; `content.fetch` unavailable in MV3.
- [S11] refined-github source, `main` branch (https://github.com/refined-github/refined-github): `source/github-helpers/batch-deferred-content.ts`, `source/features/subscribe-releases.tsx`, `source/features/status-subscription.tsx` - same-origin `fetch` from a content script with `X-Requested-With` / `GitHub-Verified-Fetch` headers.
- [S12] github.com response headers for [S1]/[S2]: `Vary`, `Cache-Control`, `Content-Security-Policy` (`connect-src 'self' ... api.github.com ...`).

Legend: **[observed]**, **[claimed]**, **[inference]** as in the sibling docs.

## 1. Embedded page payload (free, already in the page)

[observed, S1] Each code-view HTML page embeds the route payload as JSON. Shape (abridged):

```json
{ "payload": {
    "codeViewRepoRoute" | "codeViewTreeRoute": {
      "path": "src/vs",
      "refInfo": { "name": "main", "refType": "branch",
                   "currentOid": "972b66fd...", "listCacheKey": "v0:1794800188.0" },
      "tree": { "items": [ { "name": "base", "path": "src/vs/base", "contentType": "directory" } ],
                "totalCount": 10, "readme": null } },
    "codeViewLayoutRoute": { "repo": { "id": 41881900, "defaultBranch": "main", "ownerLogin": "microsoft",
                                       "name": "vscode", "private": false } },
    "codeViewFileTreeLayoutRoute": { "fileTree": { "src/vs": {"items": [...]}, "src": {...}, "": {...} },
                                     "foldersToFetch": [] } } }
```

- Root page uses `codeViewRepoRoute` (with `isOverview: true`, `path: "/"`); folder pages use
  `codeViewTreeRoute`.
- Folder pages also embed the **ancestor listings** in `codeViewFileTreeLayoutRoute.fileTree`
  (keyed by path, `""` = root) for GitHub's sidebar tree.
- Item fields observed: `name`, `path`, `contentType` (`directory`, `file`, `submodule`,
  `symlink_file`), optional `hasSimplifiedPath` (collapsed single-child chain), and for submodules
  `submoduleUrl`, `submoduleDisplayName` [S1][S2].
- `refInfo.name` and `path` resolve the ref/path ambiguity of branch names containing `/`
  (`branch/with/slashes` came back as `name` = `branch/with/slashes`, `path` = `/`) [S2].
- Limitation [inference]: the `<script>` element reflects the **initial** document only. After a
  soft navigation it is stale; the live route payload exists only in React state (and in the
  page-world `soft-nav:payload` event, which isolated content scripts cannot read reliably).
  Use it for the first view at most, or not at all.

## 2. Same-origin tree JSON endpoint (recommended primary)

`GET https://github.com/<owner>/<repo>/tree/<ref>/<path>` with header `Accept: application/json`.

[observed, S2][S12]

- Returns `200 application/json` with `{"meta": {...}, "payload": {"codeViewTreeRoute": {...}}}`:
  the same `tree.items` shape as section 1 (no layout/sidebar blocks). ~1.2 KB for a 10-entry folder.
- Worked **with only the `Accept` header**; no cookie, no `X-Requested-With`, no
  `GitHub-Verified-Fetch` was needed for a public repo. `Vary` lists `Accept`, `X-Requested-With`,
  `Turbo-Frame`, `X-GitHub-Client-Version`, `Sec-Fetch-Site` and others, so responses differ per header.
- `Cache-Control: max-age=0, private, must-revalidate`.
- No `x-ratelimit-*` headers; five rapid requests all returned 200. Not documented, so actual
  throttling thresholds are unknown.
- Nonexistent path: `404` with `application/json`. Nonexistent (or, logged out, private) repo: `404`.
- **Items are capped at 1,000**: DefinitelyTyped `types` returned 1,000 items with `totalCount: 8582`.
  No pagination cursor was present.
- **No CORS headers** (no `Access-Control-Allow-Origin` even when sent `Origin: https://example.com`),
  so only same-origin callers can read it.

What GitHub's own client sends [observed, S4]: its fetch wrapper adds `GitHub-Verified-Fetch: true`,
`X-Requested-With: XMLHttpRequest` and `X-GitHub-Client-Version: <meta name="release">`. refined-github
sends `Accept: application/json` + `X-Requested-With: XMLHttpRequest` (and `GitHub-Verified-Fetch: true`
on some calls) from content scripts with `credentials: 'include'` [S11]. Mirroring
`Accept` + `X-Requested-With` (+ `GitHub-Verified-Fetch`) is the lowest-risk choice [inference].

Private repos [claimed + inference]: in MV3 on Chrome and Firefox, a content script's `fetch('/...')`
is made in the page context, "on behalf of the web origin" it was injected into [S9][S10]. A
same-origin request to `https://github.com/...` therefore carries the user's `github.com` session
cookies (default `credentials: 'same-origin'`), so private repositories the user can see should work
with no token. **Not verified** here (no credentials used, by design). Page `connect-src 'self'`
also permits it [S12].

Related same-origin endpoints [observed, S3]:

- `/<o>/<r>/tree-commit-info/<ref>/<path>` -> `{"entries": {"<name>": {oid, url, date, shortMessageHtmlLink, ...}}}`:
  per-entry last-commit data that fills the listing's commit columns. GitHub's code view loads it as a
  deferred query named `treeCommitInfo` [S4]. Optional for v1 (nested rows could show name only).
- `/<o>/<r>/latest-commit/<ref>/<path>` -> latest commit for the folder (the commit bar).
- `/<o>/<r>/tree-list/<commit-oid>` -> `{"paths": [...]}`: every **file** path in the repo
  (20,815 paths, 1.5 MB for vscode). Powers "Go to file". Too heavy for lazy expansion; no folder
  entries, so empty dirs/submodules are missing.

## 3. REST fallbacks (api.github.com)

[observed, S5] `api.github.com` sends `Access-Control-Allow-Origin: *` and exposes `X-RateLimit-*`
headers, so a content script can call it cross-origin **without credentials**. Calls are unauthenticated
(60/h per IP) unless the extension supplies a token.

### 3.1 Contents API

`GET /repos/{owner}/{repo}/contents/{path}?ref={ref}`

- [claimed, S6] Directory -> array of entries; `ref` optional (default branch); "upper limit of
  1,000 files for a directory"; for more use the Git Trees API. `application/vnd.github.object+json`
  wraps directory arrays in `entries`.
- [observed, S5] Entry keys: `name, path, sha, size, type, url, html_url, git_url, download_url, _links`;
  `type` values seen `dir`, `file` (schema also has `symlink`, `submodule` [S6]).

### 3.2 Git Trees API

`GET /repos/{owner}/{repo}/git/trees/{tree_sha}[?recursive=1]`

- [claimed, S7] `tree_sha` accepts a SHA or a ref name. Recursive responses are limited to
  "100,000 entries" and "7 MB"; `truncated: true` signals overflow, after which subtrees must be
  fetched non-recursively one at a time.
- [observed, S5] `microsoft/vscode` `main?recursive=1`: 26,069 entries, `truncated: false`.
  Entry: `{path, mode, type: "tree"|"blob"|"commit", sha, size?, url}` (`commit` = submodule).
- Non-recursive calls give one level per request and return each subfolder's `sha`, so lazy
  expansion can walk by SHA (stable per commit, cacheable forever).

### 3.3 Rate limits [claimed, S8]

| Caller | Primary limit |
|---|---|
| Unauthenticated | 60 requests/hour per IP ("core" resource; observed `x-ratelimit-limit: 60`, S5) |
| Authenticated user (PAT/OAuth) | 5,000/hour (15,000 for Enterprise Cloud org-owned apps) |
| Secondary | max 100 concurrent; 900 points/min REST (GET = 1 point); CPU-time limits |

Unauthenticated 60/h is shared with everything else on the user's IP; a user expanding a few dozen
folders would exhaust it. Authenticated use requires asking the user for a token, which conflicts with
the "github.com only, no telemetry, minimal permissions" goal and adds secret storage.

## 4. Native file-tree sidebar data

[observed, S1][S2] GitHub's own sidebar tree on `/tree/` and `/blob/` pages is fed by the same tree
JSON (embedded `fileTree` for ancestors, `foldersToFetch` for pending loads). Its React state is not
reachable from an isolated content script, and its DOM is client-rendered and hidden when collapsed.
Reusing it would mean scraping a hidden widget; reusing its **endpoint** (section 2) is the practical
form of reuse [inference].

## 5. Recommendation

[inference]

1. **Primary**: same-origin `fetch(\`/${owner}/${repo}/tree/${encodeRef(ref)}/${encodePath(path)}\`, {headers: {Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'GitHub-Verified-Fetch': 'true'}, credentials: 'same-origin'})`
   from the content script. Parse defensively: locate `payload.*.tree.items` (route key may change),
   validate each item (`name`/`path` strings, known `contentType`), ignore unknown types. Works for
   public and (expected) private repos with no extra permission, no token, no CORS.
2. Take `owner/repo` from the URL and `ref` from a stable source: the item `href`s in the listing
   (`/tree/<ref>/<path>` minus the known `path`) or the first JSON response's `refInfo.name`. Prefer
   `refInfo.currentOid` as the cache key component (cache `Map<oid + path, items>` per page view).
3. Show "N more" with a link to the folder page when `totalCount > items.length` (1,000 cap).
4. **Fallback** (optional, off by default): REST `contents` API, unauthenticated, only on public repos,
   with a visible message on 403/429 and respect for `x-ratelimit-reset`. Skip Git Trees recursive
   prefetch; it is wasteful for lazy expansion.
5. Limit concurrency (e.g. 4 in flight), debounce rapid toggles, abort on navigation.

## Open questions / risks

1. The tree JSON endpoint is undocumented and versionless; its shape (`codeViewTreeRoute`) changed
   name between root and tree pages already and can change in any deploy. Add a schema check and a
   graceful "could not load" state.
2. Private-repo behavior with session cookies, SSO-enforced orgs (SAML), and Firefox's cookie
   partitioning / Total Cookie Protection in content-script fetches is unverified. Test logged in on
   both browsers.
3. Undocumented throttling on github.com HTML/JSON routes; heavy users could hit abuse detection.
   Keep request volume equal to user clicks.
4. Ref encoding: branch names with `/`, `#`, `%` or unicode; verify `encodeURIComponent` per path
   segment against GitHub's routing.
5. `hasSimplifiedPath` rows: the endpoint for the deepest folder must be used; confirm GitHub
   also simplifies nested responses (it did for the root listing).
6. Submodule entries point to other repositories; do not expand them inline in v1.
