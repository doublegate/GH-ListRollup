# Settings Specification

**Status:** Draft v0.1 (2026-11-15) | **Tickets:** Phase 3 Sprint 1
**Sources:** `ref-docs/research-report.md` §4 (storage APIs), `ref-docs/wxt-framework.md` (storage helper)

## 1. Settings

| Key                       | Type                        | Default       | Area    | Meaning                                                                   |
| ------------------------- | --------------------------- | ------------- | ------- | ------------------------------------------------------------------------- |
| `listing.defaultState`    | `"collapsed" \| "expanded"` | `"collapsed"` | `sync`  | Level 1 state on page load.                                               |
| `listing.rememberPerRepo` | `boolean`                   | `false`       | `sync`  | Remember the last Level 1 state per `owner/repo`.                         |
| `listing.showCount`       | `boolean`                   | `true`        | `sync`  | Show the "N items" badge on a collapsed header.                           |
| `tree.enabled`            | `boolean`                   | `true`        | `sync`  | Add Level 2 arrows to folder rows.                                        |
| `tree.maxChildren`        | `number` (100-5000)         | `1000`        | `sync`  | Inline row cap per folder (`docs/ui-behavior.md` §3.2).                   |
| `api.token`               | `string \| null`            | `null`        | `local` | Optional GitHub token for the REST fallback (`docs/data-fetching.md` §4). |
| `debug.logging`           | `boolean`                   | `false`       | `local` | Verbose console logging with the `[gnr]` prefix.                          |

The per-repo memory map lives under `local` as `repoState:<owner>/<repo>` →
`"collapsed" | "expanded"`, capped at 500 entries with least-recently-used eviction, so it never
approaches the `storage.local` quota.

## 2. Rules

- **Areas.** Preferences go in `storage.sync` so they follow the user across devices. The token and the
  per-repo map go in `storage.local`: a token must not sync, and the map would exceed sync's small
  per-item and total quotas.
- **Schema.** Every key is declared once with WXT's storage helper (`storage.defineItem`) with a
  default and a version number, in `src/settings.ts`. Readers never hand-write key strings.
- **Validation.** Values read from storage are validated (type and range) before use; an invalid value
  falls back to the default and is logged under `debug.logging`.
- **Read early.** The content script starts reading `listing.defaultState`, `listing.rememberPerRepo`
  and the current repo's `repoState` entry at `document_start`. The first apply waits for that read
  while the pre-hide is in place. When the result is `expanded`, the pending attribute is cleared as
  soon as the read returns, so the rows are hidden only for the length of the read, which the
  4-second watchdog bounds (`docs/dom-integration.md` §4).
- **Live updates.** The content script watches the items it uses, so changing a setting applies to open
  GitHub tabs without a reload.
- **Migration.** A bumped item version supplies a migration function. Removing a key requires a
  migration that deletes it.

## 3. Options page

- Opened from the extensions menu (`options_ui`, `open_in_tab: false`).
- Plain HTML + TypeScript, styled with system colors, with no framework.
- The token field is a password input with a "Test token" button that calls
  `GET https://api.github.com/rate_limit` from the background script and shows the remaining quota. It
  never displays a saved token back, only "Token saved (ends in ...abcd)" with a "Remove" button.
- A "Reset to defaults" button clears `sync` and the per-repo map, but leaves the token alone.
