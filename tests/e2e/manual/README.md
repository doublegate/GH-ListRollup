# tests/e2e/manual: standalone browser checks

These are one-off Playwright scripts written for ticket T-GNR-004 (2026-11-16). Each loads the built
Chrome extension into Playwright's bundled Chromium, drives live github.com while logged out, and
prints every `[gnr]` console line, grouped by step.

They are **not** part of `pnpm test` or CI. Playwright is not yet a project dependency; T-GNR-401
adds `@playwright/test` and a proper E2E suite, which should absorb these scripts.

| Script            | Purpose                                                                                                                                                                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t-gnr-004.mjs`   | Root, folder, Back, Issues and Code navigation, plus the extension-reload check. A page-world marker confirms that each step was a soft navigation.                                                                                                                                             |
| `reload-diag.mjs` | Shows that after `chrome.runtime.reload()`, Playwright's Chromium does not restore an extension that was side-loaded with `--load-extension`. That limit belongs to the automation harness, not the extension (see the T-GNR-004 notes in `to-dos/phase-0-foundation/sprint-1-skeleton-ci.md`). |
| `t-gnr-109.mjs`   | Phase 1 exit check (T-GNR-109): one collapsed toggle on a cold load, click to show and hide, 20 consecutive soft navigations each leaving one collapsed toggle, and screenshots of the collapsed header in light and dark themes (`node t-gnr-109.mjs <extension> [<screenshot dir>]`).         |

## Running

From the project root, build the extension, then run the scripts from a scratch directory that has
Playwright installed:

```sh
pnpm build
mkdir -p ~/scratch/gnr-pw && cd ~/scratch/gnr-pw
npm init -y >/dev/null && npm i playwright@1.65.1 && npx playwright install chromium
cp <repo>/tests/e2e/manual/*.mjs .
node t-gnr-004.mjs <repo>/.output/chrome-mv3
```

`t-gnr-004.mjs` exits 1 if steps 1-6 differ from the expected `[gnr]` output (steps 7-8 are
recorded only, because of the harness limit above), and exits 2 without a built extension path.

ESLint lints the scripts without type information (`eslint.config.js`), because they import
`playwright`, which is not installed in the project.
