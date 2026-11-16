# Phase 2: Inline Nested Folder Tree

## Goal

Each folder row in the expanded listing gets an arrow. Folders start collapsed and expand in place,
recursively, with children fetched lazily from the same-origin tree JSON, cached for the page view,
and accessible by keyboard (`docs/ui-behavior.md` §3, `docs/data-fetching.md`).

## Exit criteria

- [ ] Three levels of expansion work on a public repo and on a private repo, logged in, in both
      browsers, with no token configured.
- [ ] Re-expanding a folder makes 0 network requests (test).
- [ ] Hostile-name fixture renders as text, and all links resolve correctly.
- [ ] Decision recorded on whether the REST fallback ships in v1 (ADR 0003, or an amendment to
      ADR 0002).

## Scope

- **In scope:** the data layer, the tree controller, inline rows, the keyboard model, error rows,
  simplified chains, the 1,000-item cap.
- **Out of scope:** the REST fallback implementation (Phase 3) and last-commit columns for inline
  rows (not planned).

## Sprints

- [Sprint 1: Data layer](sprint-1-data-layer.md)
- [Sprint 2: Tree controller and UI](sprint-2-tree-ui.md)

## Dependencies

Phase 1 complete.

## Risks

- **Private repos fail through the same-origin fetch in Firefox, or in SAML orgs.** Detect: spike
  T-GNR-201. Response: promote the REST fallback with a token to required for those cases.
- **React drops inline rows on re-render.** Detect: fixture re-render test. Response: re-insert from
  the state map.
- **Undocumented throttling.** Detect: 429 responses. Response: a backoff, and a lower concurrency
  cap.

## Reference docs

- `docs/data-fetching.md`
- `docs/ui-behavior.md` §3
- `docs/adr/0002-same-origin-tree-json.md`
