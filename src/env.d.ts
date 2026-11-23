/**
 * `import.meta.env` (Vite's `DEV`, `PROD`, `MODE`), constant-folded at build time. Referenced here
 * rather than through `.wxt/wxt.d.ts`, which would also declare WXT's auto-import globals and could
 * hide a missing import.
 */
/// <reference types="wxt/vite-builder-env" />
