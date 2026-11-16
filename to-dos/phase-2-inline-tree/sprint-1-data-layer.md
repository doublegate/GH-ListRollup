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

**Dependencies:** Phase 1 | **Reference:** `ref-docs/research-report.md` §7 R5 | **Complexity:** S

---

### T-GNR-202: `parseTreeJson()`

**Description:** A defensive parser per `docs/data-fetching.md` §2: search `payload.*.tree.items`,
map `contentType`, handle `hasSimplifiedPath`, `totalCount` and `refInfo`, drop and count malformed
items, and throw `SchemaError` when no items array is found.

**Acceptance criteria:**

- [ ] Passes every JSON fixture case from T-GNR-013.
- [ ] A property test: random extra fields and unknown route keys never throw except `SchemaError`.

**Dependencies:** T-GNR-013 | **Reference:** `docs/data-fetching.md` §2 | **Complexity:** M

---

### T-GNR-203: URL builder

**Description:** `buildTreeUrl(key)` and `buildEntryHref(page, entry)`. They validate owner and repo,
encode each segment, and use `new URL` against `location.origin`.

**Acceptance criteria:**

- [ ] The hostile-name table in `docs/testing-strategy.md` §2 passes.
- [ ] Slash refs produce GitHub's canonical URL shape.

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

- [ ] Unit tests for each behaviour, using a stubbed `fetch`.
- [ ] The headers sent match `docs/data-fetching.md` §2 exactly.

**Dependencies:** T-GNR-202, T-GNR-203 | **Reference:** `docs/data-fetching.md` §3, §5 | **Complexity:** M

---

## Sprint review checklist

- [ ] Coverage of `src/data/` is at least 80% lines.
- [ ] The spike outcome is reflected in the Phase 3 plan.
