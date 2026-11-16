# ADR 0002: Same-origin tree JSON as the primary folder data source

**Status:** Accepted (2026-11-15)
**Deciders:** DoubleGate
**Related:** `docs/data-fetching.md`, `ref-docs/github-data-sources.md`

## Context

Expanding a folder inline needs that folder's children. The candidates were (`ref-docs/github-data-sources.md`):

1. **The JSON embedded in the page** (`react-app.embeddedData`). It is free, but it covers only the
   current folder, and it goes stale after a soft navigation.
2. **The same-origin `GET /<o>/<r>/tree/<ref>/<path>` with `Accept: application/json`.** This is the
   endpoint GitHub's own code view and sidebar tree use. It is undocumented. From a content script it
   carries the user's session, has no published rate limit, and is capped at 1,000 items per folder.
3. **The REST Contents API on `api.github.com`.** It is documented and stable, but allows only 60
   requests per hour per IP without a token. Private repositories need a token.
4. **The recursive REST Git Trees API.** One call returns the whole repository, limited to 100,000
   entries or 7 MB. That is wasteful for lazy expansion and has the same token problem.

The project goals are github.com-only permissions, no account setup, and private repositories working
out of the box.

## Decision

Use (2) as the only source in normal operation, fetched from the content script.

Keep (3) as an optional fallback, used only when (2)'s response no longer parses, meaning GitHub
changed its shape. It runs in the background script, and uses a user-supplied token if one is set.

## Consequences

- No token and no setup. Private repositories work wherever the user is signed in. No API quota is
  consumed.
- GitHub can change the endpoint in any deploy. This is mitigated by:
  - defensive parsing that searches `payload.*.tree.items`
  - a `SchemaError` path to the fallback
  - recorded-response fixture tests
  - a weekly live probe in CI
- Folders with more than 1,000 children show a "Show all on GitHub" row.
- The fallback requires the `https://api.github.com/*` host permission and token storage.
  - If the primary source proves stable through Phase 3, a superseding ADR should consider dropping
    both, to shrink the permission set.
  - The token interacts with AMO's `data_collection_permissions` declaration; see
    `docs/release.md` §3.
