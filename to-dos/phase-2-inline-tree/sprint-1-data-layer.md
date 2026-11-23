# Phase 2, Sprint 1: Data Layer

**Phase:** 2, Inline tree
**Sprint goal:** a tested `FolderSource` backed by the same-origin tree JSON.
**Estimated duration:** 1 week

## Tickets

### T-GNR-201: Spike: tree JSON logged in, on private repos, in both browsers

**Description:** From the skeleton content script, fetch the tree JSON for a private repository the
test account can see, in Chrome and in Firefox (with Total Cookie Protection on). Repeat for a
SAML-enforced organization if one is available. Record status codes and response shapes. Never log
private names or paths in committed material.

**Acceptance criteria:**

- [ ] Findings written to `ref-docs/research-update-<date>-tree-json-auth.md`.
- [ ] Open question 2 in the research report answered.
- [ ] The go/no-go for "no token needed" is stated explicitly.

**How to run it (status: probe built, awaiting the signed-in runs):** the probe is
`src/dev/spike.ts`, wired into the content script only in development builds (`import.meta.env.DEV`;
the production bundle does not contain it). It logs, at info level, one line per attempt with status
codes, counts and booleans only, never a name or path:

1. `pnpm dev` (Chrome) or `pnpm dev:firefox`. The browser opens with a fresh profile: sign in to
   GitHub there yourself.
2. Open a private repository the account can see, then one of its folders. In Firefox, keep Total
   Cookie Protection on (the default, Enhanced Tracking Protection Standard).
3. In the page's DevTools console (Firefox: the content-script messages appear in the page console),
   copy the `[gnr] spike T-GNR-201 ...` lines. Chrome logs one attempt (`via=fetch`); Firefox logs
   two (`via=fetch` and `via=content.fetch`, the page-principal fetch).
4. Repeat on a public repository as the control, and on a SAML-enforced organization if available.

`status=200 json=yes items=N` with `private=true` means the content script reaches private trees
with no token; a `404`, a redirect to the sign-in host or `json=no` means it does not, for that
`via`.

**Dependencies:** Phase 1 | **Reference:** `ref-docs/research-report.md` §7 R5 | **Complexity:** S

---

### T-GNR-202: `parseTreeJson()`

**Description:** A defensive parser per `docs/data-fetching.md` §2: search `payload.*.tree.items`,
map `contentType`, handle `hasSimplifiedPath`, `totalCount` and `refInfo`, drop and count malformed
items, and throw `SchemaError` when no items array is found.

**Acceptance criteria:**

- [x] Passes every JSON fixture case from T-GNR-013.
- [x] A property test: random extra fields and unknown route keys never throw except `SchemaError`.

**Dependencies:** T-GNR-013 | **Reference:** `docs/data-fetching.md` §2 | **Complexity:** M

---

### T-GNR-203: URL builder

**Description:** `buildTreeUrl(key)` and `buildEntryHref(page, entry)`. They validate owner and repo,
reject empty, `.` and `..` segments in owner, repo, ref and path, encode each segment, use `new URL`
against `location.origin`, and then check the result's origin and pathname prefix
(`docs/data-fetching.md` §2). A failure throws `InvalidKeyError` before any request.

**Acceptance criteria:**

- [x] The hostile-name table in `docs/testing-strategy.md` §2 passes.
- [x] Slash refs produce GitHub's canonical URL shape.
- [x] Traversal is refused: path `a/../../settings`, path `.`, ref `main/..`, repo `..` and an empty
      segment (`a//b`) each throw `InvalidKeyError`, and the stubbed `fetch` is never called.
- [x] A literal name `%2e` builds `.../%252e`, and every built URL has origin `https://github.com`
      and a pathname that starts with `/<owner>/<repo>/tree/` (tree fetches and folder links) or
      `/<owner>/<repo>/blob/` (file links).

**Dependencies:** none | **Reference:** `docs/security-privacy.md` §2.2 | **Complexity:** S

---

### T-GNR-204: Fetcher (cache, de-duplication, queue, abort, timeout)

**Description:** `src/data/fetcher.ts` implements `FolderSource` with:

- an LRU cache of 200 entries, keyed by `owner/repo@oid:path`
- in-flight de-duplication
- at most 4 concurrent requests
- an `AbortSignal` from `ctx.signal` and navigation
- a 10-second timeout
- the error model in `docs/data-fetching.md` §5

**Acceptance criteria:**

- [x] Unit tests for each behaviour, using a stubbed `fetch`.
- [x] The headers sent match `docs/data-fetching.md` §2 exactly.

**Dependencies:** T-GNR-202, T-GNR-203 | **Reference:** `docs/data-fetching.md` §3, §5 | **Complexity:** M

---

## Sprint review checklist

- [ ] Coverage of `src/data/` is at least 80% lines.
- [ ] The spike outcome is reflected in the Phase 3 plan.
