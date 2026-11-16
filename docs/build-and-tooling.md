# Build and Tooling

**Status:** Current as of 2026-11-15 (Phase 0 skeleton)
**Sources:** `ref-docs/wxt-framework.md`, `ref-docs/testing-extensions.md`, `docs/adr/0001-wxt-typescript.md`

## 1. Toolchain (pinned)

Every devDependency in `package.json` is pinned to an exact version, with no `^`. AMO reviewers must be
able to rebuild byte-identical output (`docs/release.md` §3).

| Tool                                              | Version                               | Notes                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Node                                              | 26 LTS (`.nvmrc`), `engines` >= 22.18 | WXT needs Node 22 or later                                                                                                                 |
| pnpm                                              | 12.21.0 (`packageManager`)            | Use `corepack enable` to get the pinned version                                                                                            |
| wxt                                               | 0.21.5                                | `vite` 8.3.8 is a required peer and is listed explicitly                                                                                   |
| @wxt-dev/storage                                  | 1.3.0                                 | Used from Phase 3 (`docs/settings.md`)                                                                                                     |
| typescript                                        | 6.0.3                                 | **Do not upgrade to 7.x** until `typescript-eslint` supports it (8.72.2 and the 8.72.3 canary both require `<6.1.0`; rechecked 2026-11-16) |
| eslint / @eslint/js / typescript-eslint / globals | 10.15.0 / 10.0.1 / 8.72.2 / 17.14.0   | Flat config, type-checked rules                                                                                                            |
| prettier                                          | 3.10.1                                |                                                                                                                                            |
| vitest / @vitest/coverage-v8 / happy-dom          | 5.1.0 / 5.1.0 / 21.0.4                |                                                                                                                                            |
| web-ext                                           | 10.8.0                                | Lints the Firefox build                                                                                                                    |
| @playwright/test                                  | 1.65.1                                | Added in Phase 4 (T-GNR-401)                                                                                                               |

## 2. Layout

```text
wxt.config.ts            manifest function: shared keys, Firefox gecko block, Chrome minimum
vitest.config.ts         WxtVitest + happy-dom
eslint.config.js         flat config; bans HTML sinks (docs/security-privacy.md §2)
src/
  entrypoints/
    content/index.ts     the content script (matches https://github.com/*, document_start)
    background.ts        service worker (Chrome) / event page (Firefox)
  github/                page detection, navigation, selectors (pure; no feature imports)
  log.ts                 [gnr]-prefixed logging
tests/unit/              Vitest
.output/                 build output (gitignored): chrome-mv3/, firefox-mv3/
.wxt/                    generated types and tsconfig (gitignored; created by `wxt prepare`)
```

Imports use the `@/` alias for `src/`. WXT APIs are imported explicitly from their subpaths, such as
`wxt/utils/define-content-script`, rather than relying on auto-imports.

## 3. Commands

| Command                             | What it does                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm install`                      | Installs, then `postinstall` runs `wxt prepare` to generate `.wxt/`           |
| `pnpm dev` / `pnpm dev:firefox`     | Dev build with reload. WXT launches a browser at the `webExt.startUrls` page. |
| `pnpm build` / `pnpm build:firefox` | Production builds into `.output/chrome-mv3` and `.output/firefox-mv3`         |
| `pnpm zip` / `pnpm zip:firefox`     | Store packages. The Firefox command also writes the AMO sources zip.          |
| `pnpm typecheck`                    | `tsc --noEmit` (needs `.wxt/` from `wxt prepare`)                             |
| `pnpm lint`                         | ESLint, zero warnings allowed                                                 |
| `pnpm lint:firefox`                 | `web-ext lint --warnings-as-errors` on the Firefox build                      |
| `pnpm format` / `pnpm format:check` | Prettier                                                                      |
| `pnpm test` / `pnpm test:coverage`  | Vitest                                                                        |
| `pnpm check`                        | Every gate in CI order                                                        |

### Loading unpacked builds

- **Chrome:** open `chrome://extensions`, enable Developer mode, choose "Load unpacked" and select
  `.output/chrome-mv3`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, choose "Load Temporary Add-on" and select
  `.output/firefox-mv3/manifest.json`. Alternatively run `pnpm dev:firefox`.

The Phase 0 skeleton logs `[gnr] page <kind> [<owner>/<repo>] path=<path>` to the page console on
load and after each soft navigation, for example
`[gnr] page repo-tree wxt-dev/wxt path=/wxt-dev/wxt/tree/main/packages`.

**Verify Firefox behaviour on a production build.** `pnpm dev:firefox` registers the content script
dynamically. On 2026-11-16 its hot reload left a tab running the old script, even after F5
(T-GNR-004). For real checks, run:

```sh
pnpm build:firefox
pnpm exec web-ext run --source-dir .output/firefox-mv3 --start-url https://github.com/<owner>/<repo>
```

`web-ext run` fully reloads the extension whenever `.output/firefox-mv3` changes, so running
`pnpm build:firefox` again triggers a reload. Firefox re-injects content scripts into already-open
tabs on reload; Chrome does not.

## 4. CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. It uses Ubuntu, Node 26 and
pnpm via corepack, with action versions pinned. Two jobs:

- **check** runs `pnpm install --frozen-lockfile`, then `pnpm audit`, `pnpm check` and the
  Antigravity reviewer self-test (`scripts/agy-review-selftest.sh`), then uploads both builds as
  artifacts.
- **secrets** scans the full git history with gitleaks, a pinned and checksum-verified binary using
  the built-in rules. The repo has no `.gitleaks.toml`. If one is ever added, it must start with
  `[extend] useDefault = true`; otherwise it silently replaces every built-in rule.

`.github/workflows/antigravity-review.yml` is the **Antigravity PR reviewer**, installed from the
workspace template. Operations guide: `.github/AGY-REVIEWER.md`; project rules:
`.github/agy-review.md`.

- **Triggers:** every same-repository PR is reviewed on open and on each push, and `/agy-review`
  in a PR comment re-runs it. Reviews come from `agy` on a long-lived self-hosted runner labelled
  `agy`: `github-agy-runner@gh-listrollup`, a `systemd --user` service that runs while the
  maintainer is logged in.
- **Fork PRs** need approval for every outside contributor before any workflow runs.
- **Keep the template files in sync with the template.** The workflow and the operations doc are
  excluded from Prettier, because the self-test parses the workflow. The doc is byte-identical.
  The workflow differs in exactly one way: the template's first-install bootstrap steps are
  omitted. They could never fire once the reviewer was on `main`, and they trip CodeQL
  `actions/untrusted-checkout`; RustyNES does the same. Update both only by re-syncing from the
  template, then re-apply that omission.

To run the secret scan locally, give gitleaks an **absolute path**:
`gitleaks git "$PWD" --redact`. On this workstation the `gitleaks` command is a wrapper that changes
into its own install directory first, so `gitleaks dir .` scans the wrapper's files, not the
project.

### Dependency overrides and audit exceptions

These live in `pnpm-workspace.yaml`. pnpm 10 and later ignore the `pnpm` field in `package.json`.

| Entry                                                | Why                                                                                                                                                            | Remove when                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `overrides`: `minimatch@>=7.0.0 <11.0.1` to `11.0.8` | GHSA-g3hv-75wg-m249 (moderate) in a copy pulled by `@typescript-eslint/typescript-estree`. Dependabot cannot bump transitive pins.                             | typescript-eslint depends on minimatch 11.0.1 or later itself |
| `auditConfig.ignoreGhsas`: GHSA-gcqx-w48m-w2h4       | deepmerge 4.3.1, low. No patched release exists. It is reached only through web-ext > addons-linter at lint time, with no untrusted input, and is not shipped. | web-ext drops or replaces deepmerge, or a fix is released     |

Dependabot is configured in `.github/dependabot.yml`: grouped monthly updates for npm and Actions,
with TypeScript held below 6.1. Upgrade sweeps re-check every pin with `npm view <pkg> version`.

Planned additions:

- Phase 4: the Playwright Chromium job, and a weekly live-probe job (`schedule:`).
- Phase 5: a release workflow triggered by `v*` tags that runs `pnpm zip` and `pnpm zip:firefox`.

## 5. Conventions

- Conventional Commits. Ticket IDs (`T-GNR-NNN`) go in the commit body and PR description.
- No emojis in code, commits or docs.
- Every user-visible change adds a line under `[Unreleased]` in `CHANGELOG.md`.
- Behaviour changes update the matching `docs/*.md` in the same change.
