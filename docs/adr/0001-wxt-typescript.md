# ADR 0001: WXT + TypeScript for a single Chrome and Firefox codebase

**Status:** Accepted (2026-11-15)
**Deciders:** DoubleGate
**Related:** `docs/build-and-tooling.md`, `ref-docs/wxt-framework.md`, `ref-docs/cross-browser-differences.md`

## Context

The extension must ship as MV3 on Chrome and on Firefox. The two differ in:

- the background type: service worker in Chrome, event page in Firefox
- the Firefox-only `browser_specific_settings.gecko` block, including the `data_collection_permissions`
  declaration AMO requires
- the API namespace and promise support
- packaging: AMO requires a reproducible sources archive

Three options were considered:

1. **WXT + TypeScript.**
2. **Plain TypeScript with esbuild,** hand-written manifests per browser, and `webextension-polyfill`.
3. **Vanilla JavaScript with no build.**

## Decision

Use WXT 0.21 with TypeScript (strict), pnpm, Vitest and ESLint flat config. Specifically:

- `manifestVersion: 3` for every target.
- A manifest function in `wxt.config.ts` holds the per-browser keys.
- WXT's `browser` global, with no polyfill.
- `ContentScriptContext` for lifecycle-safe listeners.
- `@wxt-dev/storage` for settings.

## Consequences

- One manifest source and one command set (`build`, `build:firefox`, `zip:firefox`, which includes the
  AMO sources zip). Dev mode with reload in both browsers.
- `ctx.onInvalidated`, `ctx.addEventListener` and `ctx.signal` handle the stale-content-script problem
  that caused duplicate-injection bugs in prior art (`ref-docs/prior-art.md`).
- WXT is pre-1.0, and minor versions break things: v0.20 removed the polyfill, and v0.21 changed the
  zip source rules, removed `wxt/testing` and renamed `runner`. The project pins exact versions and
  treats a WXT upgrade as a ticket with its own verification.
- WXT builds Firefox as MV2 by default. That is overridden in config and verified by the generated
  manifest check.
- TypeScript stays at 6.0.x until `typescript-eslint` supports 7.x.
