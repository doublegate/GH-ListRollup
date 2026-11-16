# Data Fetching Specification

**Status:** Draft v0.1 (2026-11-15) | **Tickets:** Phase 2 Sprint 1, Phase 3 Sprint 2
**Sources:** `ref-docs/github-data-sources.md` (endpoints, limits, observed shapes),
`ref-docs/chrome-mv3.md` and `ref-docs/firefox-mv3.md` (CORS for content scripts),
`docs/adr/0002-same-origin-tree-json.md`

## 1. Interface

```ts
// src/data/types.ts
type EntryKind = 'dir' | 'file' | 'submodule' | 'symlink' | 'unknown';

interface TreeEntry {
  name: string; // display name (may be "a/b/c" for a simplified chain)
  path: string; // repo-relative path of the entry (deepest folder for a chain)
  kind: EntryKind;
  simplified: boolean; // true for a single-child folder chain
}

interface FolderListing {
  entries: TreeEntry[]; // GitHub order: folders first, then files
  totalCount: number; // may exceed entries.length (1,000-item cap)
  refName: string;
  commitOid: string | null;
  source: 'tree-json' | 'rest-contents';
}

interface FolderSource {
  list(key: FolderKey, signal: AbortSignal): Promise<FolderListing>;
}

interface FolderKey {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}
```

The tree controller depends only on `FolderSource`. `src/data/fetcher.ts` composes a cache, the primary
source and the fallback.

## 2. Primary source: same-origin tree JSON (content script)

```text
GET https://github.com/<owner>/<repo>/tree/<ref>/<path>
Accept: application/json
X-Requested-With: XMLHttpRequest
GitHub-Verified-Fetch: true
credentials: same-origin
```

Observed behaviour (`ref-docs/github-data-sources.md` §2):

- returns `payload.codeViewTreeRoute.tree.items[]` with `name`, `path` and `contentType`
- also returns `totalCount` and `refInfo`
- `404` for a missing path or repo
- no CORS headers, so it works only same-origin
- at most 1,000 items, with no paging

Rules:

- **Runs in the content script.** MV3 content-script fetches are made as the page origin. A
  same-origin request therefore carries the user's GitHub session, and private repositories they can
  see work with no token. Neither the token nor `api.github.com` is involved.
- **URL construction.** Owner and repo are validated against `^[A-Za-z0-9_.-]{1,100}$`. Ref and path
  are split on `/` and each segment is passed through `encodeURIComponent`. The URL is joined with
  `new URL(pathname, location.origin)`.
- **Defensive parsing.** `parseTreeJson()` finds the route object by looking for the first
  `payload.*.tree.items` array rather than hard-coding `codeViewTreeRoute`, because the key has
  differed between page types. It validates each item and maps `contentType` as follows:

  | `contentType`  | `kind`      |
  | -------------- | ----------- |
  | `directory`    | `dir`       |
  | `file`         | `file`      |
  | `submodule`    | `submodule` |
  | `symlink_file` | `symlink`   |
  | anything else  | `unknown`   |

  It drops malformed items and counts them for `debug.logging`. If no items array is found, it throws
  `SchemaError`.

- **Simplified chains.** An item with `hasSimplifiedPath` gets `simplified: true`, and `path` is the
  deepest folder.

## 3. Cache and request discipline

- **Cache.** The cache is per tab and in memory, a `Map` keyed by `owner/repo@commitOid:path`.
  `refName` is used in the key until the first response supplies `commitOid`. It is cleared on soft
  navigation to a different repo or ref. Nothing is persisted, so stale data never outlives the page
  view.
- **In-flight de-duplication.** A second `list()` for a key already in flight returns the same promise.
- **Concurrency.** At most 4 requests are in flight per tab; the rest queue in FIFO order.
- **Abort.** Every request takes an `AbortSignal`. Navigating away aborts all pending requests, and
  so does WXT's `ctx.onInvalidated`.
- **Volume.** One request per user expansion. There is no prefetching in v1: GitHub's throttling of
  github.com routes is undocumented, and matching user clicks one-to-one is the safe rate.
- **Timeout.** 10 seconds per request, which maps to the "Could not load" row (`docs/ui-behavior.md`
  §3.3).

## 4. Fallback: REST Contents API (background script, optional)

The fallback is used only when the primary fails with `SchemaError`, meaning GitHub changed the JSON.
A network or HTTP error is not a reason to fall back.

```text
GET https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={ref}
Accept: application/vnd.github.object+json
Authorization: Bearer <token>        (only if the user saved one)
X-GitHub-Api-Version: 2022-11-28
```

- **Runs in the background script.** The content script sends
  `{type: 'gnr/list', owner, repo, ref, path}`. The background validates the message
  (`docs/security-privacy.md` §2.5) and builds the URL itself.
- **Limits.**
  - Unauthenticated: 60 requests per hour per IP.
  - With a token: 5,000 per hour.
  - Either way, at most 1,000 entries per directory.

  The background reads the `x-ratelimit-remaining` and `x-ratelimit-reset` headers. When it receives
  403 or 429 with `remaining=0`, it stops calling until the reset time and returns `RateLimited`.

- **Private repositories** work through the fallback only with a token.
- **Not used:** recursive Git Trees prefetch, which is wasteful for lazy expansion, and `tree-list`,
  which covers files only and is 1.5 MB on large repos.

If Phase 2 measurement shows the primary source is reliable enough, ADR 0002 may be amended to remove
the fallback together with the `api.github.com` permission.

## 5. Error model

| Error                           | Origin   | UI row                                                                                             |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `NetworkError` / `TimeoutError` | either   | "Could not load folder contents. Retry"                                                            |
| `HttpError(404)`                | primary  | "Folder not found (it may have moved). Open on GitHub"                                             |
| `HttpError(other)`              | either   | "Could not load folder contents. Retry"                                                            |
| `SchemaError`                   | primary  | Triggers the fallback. If no fallback is configured, show "Could not load" and log a probe report. |
| `RateLimited(resetAt)`          | fallback | "GitHub API rate limit reached until HH:MM. Open on GitHub"                                        |

Errors carry a status code and a short correlation id, never a token or response body.

## 6. Tests

These are covered in `docs/testing-strategy.md` §2:

- `parseTreeJson()` against recorded responses: root, nested, a 1,000-capped folder, a chain,
  submodule and symlink entries, an unknown route key, and malformed items.
- URL building with hostile names and slash refs.
- Cache: de-duplication, concurrency limit, abort.
- Fallback selection, and rate-limit back-off driven by fake headers.
