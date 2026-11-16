# Phase 3: Settings and Resilience

**Status:** Planned. Refine the tickets when Phase 2 is about 75% complete.

## Goal

Users can configure:

- the default states
- per-repo memory
- the item count
- an optional token, if the REST fallback ships

Settings apply live to open tabs. The extension keeps working, or cleanly does nothing, when GitHub
changes markup or the tree JSON shape.

## Exit criteria

- [ ] All settings in `docs/settings.md` §1 implemented, validated and applied live.
- [ ] Stripped-hook fixtures pass through the fallbacks; a schema-broken JSON fixture triggers the
      fallback (if shipped) or a clean error row.
- [ ] A permission-revoked state is detected, and the options page offers "Grant access".

## Sprints

- [Sprint 1: Settings and options page](sprint-1-settings.md)
- [Sprint 2: Resilience and fallback](sprint-2-resilience.md)

## Reference docs

- `docs/settings.md`
- `docs/data-fetching.md` §4
- `docs/dom-integration.md` §6
- `docs/cross-browser.md` §3
