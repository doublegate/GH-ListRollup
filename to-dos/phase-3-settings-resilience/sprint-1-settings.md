# Phase 3, Sprint 1: Settings and Options Page

**Phase:** 3, Settings and resilience
**Sprint goal:** typed, validated settings with an options page.
**Estimated duration:** 1 week

## Tickets

### T-GNR-301: Settings schema (`src/settings.ts`)

**Description:** Declare every item in `docs/settings.md` §1 with `storage.defineItem` (version and
fallback), add validators, and wire watchers into the collapse and tree controllers.

**Acceptance criteria:**

- [ ] Tests with `fakeBrowser`: defaults, an invalid value falls back to the default, and the watcher
      updates an open page.
- [ ] Per-repo memory map with LRU at 500 entries.

**Dependencies:** Phase 2 | **Reference:** `docs/settings.md` §1-§2 | **Complexity:** M

---

### T-GNR-303: Options page

**Description:** `src/entrypoints/options/`, plain HTML and TypeScript. It has controls for each
setting and "Reset to defaults". It also shows host-permission status, with a "Grant access" button
that calls `permissions.request()` from the click handler.

**Acceptance criteria:**

- [ ] Works in both browsers, with no `innerHTML`.
- [ ] Permission flow tested manually after revoking access in each browser.

**Dependencies:** T-GNR-301 | **Reference:** `docs/settings.md` §3, `docs/cross-browser.md` §3 | **Complexity:** M

---

### T-GNR-304: Optional count badge and compact header

**Description:** Show "N items" on the collapsed header (`listing.showCount`). Decide whether to add
the "compact header" option (open question 6 in the research report).

**Acceptance criteria:**

- [ ] Badge shows `totalCount` from page data and is hidden when unknown.
- [ ] Decision on the compact header recorded in `docs/ui-behavior.md`.

**Dependencies:** T-GNR-301 | **Reference:** `docs/ui-behavior.md` §2.2 | **Complexity:** S

---

## Sprint review checklist

- [ ] `docs/settings.md` matches the implementation.
- [ ] `CHANGELOG.md` updated.
