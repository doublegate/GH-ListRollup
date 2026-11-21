# CLAUDE.md: GH-ListRollup

## Project summary

GH-ListRollup is a Chrome and Firefox (MV3) browser extension. On every GitHub repository listing
page it collapses the folder and file listing to a single header line, the latest-commit bar, with an
expand arrow. Inside the expanded listing, folders expand in place as a lazily loaded nested tree.
Both levels start collapsed.

Folder contents come from GitHub's own same-origin tree JSON route, using the user's session. That
gives no token and no API quota, and private repositories just work. If GitHub's markup can't be
recognised, the extension does nothing rather than hide the listing.

Success means v1.0.0 on the Chrome Web Store and AMO, surviving GitHub DOM churn through ranked
selectors, fixtures and a weekly live probe.

## Repository map

```text
GH-ListRollup/
├── ref-docs/            research (historical record; do not edit, add dated supplements)
├── docs/                implementation specs (docs-as-spec) and docs/adr/
├── to-dos/              ROADMAP.md + phase-N-*/ (overview + sprint ticket files)
├── src/
│   ├── entrypoints/     content/index.ts (content script), background.ts
│   ├── github/          page detection, navigation, selectors (pure, fixture-testable)
│   └── log.ts
├── tests/unit/          Vitest
├── wxt.config.ts        manifest function (shared, Firefox gecko block, Chrome minimum)
└── .github/             CI, issue and PR templates
```

### Document index

`ref-docs/` (start with `research-report.md`; `README.md` indexes the rest):

- `initial-concept.md`: the request and its clarification, verbatim; the decisions and non-goals
- `research-report.md`: consolidated findings, risks R1-R8, open questions, primary references
- `github-code-view-dom.md`, `github-navigation-events.md`, `github-data-sources.md`: the GitHub
  internals, as observed on 2026-11-15
- `chrome-mv3.md`, `firefox-mv3.md`, `cross-browser-differences.md`, `store-publishing.md`: the
  platforms and stores
- `wxt-framework.md`, `testing-extensions.md`, `prior-art.md`: tooling and lessons from Refined
  GitHub, Tako, Gitako and Octotree

`docs/`:

- `architecture.md`: components, dependency direction, flows, state, performance budgets
- `ui-behavior.md`: the behavioural contract for both levels (states, keyboard, ARIA, errors, theming)
- `dom-integration.md`: the selector table, header-line choice, lifecycle and soft navigation,
  hydration rules
- `data-fetching.md`: the `FolderSource` interface, tree JSON, cache and queue, the REST fallback,
  the error model
- `settings.md`: setting keys, storage areas, the options page
- `cross-browser.md`: manifest per browser, version floors, runtime differences
- `security-privacy.md`: threat model, rules (no HTML from strings, token isolation), release
  checklist
- `testing-strategy.md`: test layers, fixtures, E2E, the manual checklist, gates
- `build-and-tooling.md`: pinned toolchain, layout, commands, CI
- `release.md`: Chrome Web Store, AMO (reproducible sources), the release gate, rollout
- `glossary.md`: terms
- `adr/0001-wxt-typescript.md`, `adr/0002-same-origin-tree-json.md`

`to-dos/`:

- `ROADMAP.md`: status and entry point
- `phase-0-foundation/`: skeleton, CI, fixtures
- `phase-1-listing-collapse/`: selectors, page model, collapse controller
- `phase-2-inline-tree/`: data layer (starts with spike T-GNR-201), tree UI
- `phase-3-settings-resilience/`: settings, options page, REST fallback (T-GNR-302)
- `phase-4-testing-hardening/`: Playwright E2E, Firefox smoke, live probe, performance, security
- `phase-5-release/`: store assets, reproducible build, release workflow, submission

## Where to find what

| Question                         | Read                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------- |
| What is this, and why?           | `ref-docs/initial-concept.md`, then `ref-docs/research-report.md` §1         |
| How is it structured?            | `docs/architecture.md`                                                       |
| What should the UI do?           | `docs/ui-behavior.md`                                                        |
| How do I find GitHub's elements? | `docs/dom-integration.md` (selectors live only in `src/github/selectors.ts`) |
| How are folder contents loaded?  | `docs/data-fetching.md`, ADR 0002                                            |
| What is next?                    | `to-dos/ROADMAP.md`, `PROJECT-STATUS.md`                                     |

## Project conventions

- **Language:** TypeScript 6.0.3, strict, with `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. Stay below 7.x until `typescript-eslint` supports it.
- **Framework:** WXT 0.21.5 (Vite 8). `manifestVersion: 3` for every target, `srcDir: 'src'`, `@/`
  alias. Import WXT APIs from subpaths (`wxt/utils/define-content-script`).
- **Runtime:** Node 26 LTS (`.nvmrc`), pnpm 12.21.0 via corepack (`packageManager`).
- **Versions:** exact everywhere, with no `^`, for AMO reproducible builds.
- **Testing:** Vitest 5 with `WxtVitest()` and happy-dom. `fakeBrowser` from
  `wxt/testing/fake-browser`. Playwright arrives in Phase 4.
- **Lint and format:** ESLint 10 flat config with type-checked rules and `--max-warnings 0`;
  Prettier 3. `web-ext lint --warnings-as-errors` on the Firefox build.
- **Browser API:** WXT's `browser` (no polyfill). `onMessage` uses `sendResponse` plus
  `return true`, never a returned promise.

### Hard rules

- Never set `innerHTML`, `outerHTML` or `insertAdjacentHTML`, and never build HTML from strings.
  File and folder names are attacker-controlled. Lint enforces this.
- Never use hashed GitHub classes (`Box_*__xxxx`, `prc-*-<hash>`) as selectors.
- Add, don't mutate: insert `data-gnr`-marked nodes and toggle classes. Never remove or rewrite
  GitHub's nodes. `apply()` must be idempotent.
- Never hide the listing unless the toggle is already in the DOM. The one bounded exception is the
  anti-flash pre-hide under `html[data-gnr-pending]`, set at `document_start` and at the start of an
  in-page navigation to a different listing. Every `apply()` exit that does not install the toggle
  removes it (mid-navigation, once there is a listing and header line to show), and a 4-second watchdog removes it in
  every other case (`docs/dom-integration.md` §4).
- Never derive the ref by splitting the URL; refs can contain `/`.
- Only `github.com` (and `api.github.com` for the optional fallback) are contacted. No telemetry.
  The token stays in the background script.
- Use `ctx.addEventListener`, `ctx.signal` and `ctx.onInvalidated` for every listener, observer,
  timer and fetch.

### Commit conventions

- Conventional Commits, with the ticket ID (`T-GNR-NNN`) in the body.
- Never commit or push unless asked.
- Update `CHANGELOG.md` `[Unreleased]` and the matching `docs/*.md` in the same change as any
  behaviour change.
- No emojis.

## Suggested first commands

```sh
corepack enable
pnpm install            # runs wxt prepare
pnpm check              # format, lint, typecheck, test, build, build:firefox, web-ext lint
pnpm dev                # Chrome with the extension; open a repo and watch the [gnr] console lines
pnpm dev:firefox
```

## Recommended first reads

1. This file.
2. `ref-docs/initial-concept.md`, for the exact behaviour the user asked for.
3. `ref-docs/research-report.md`.
4. `docs/architecture.md`, then `docs/dom-integration.md`.
5. `to-dos/ROADMAP.md` and the current sprint file.

## Open questions

From `ref-docs/research-report.md` §8:

- ~~Does the logged-in DOM differ from the logged-out observations?~~ Resolved 2026-11-16 (T-GNR-012):
  no selector differs. See `ref-docs/research-update-2026-11-16-logged-in-dom.md`. That page also
  records the 100-row server render limit.
- Does the same-origin tree JSON work for private repos in Firefox MV3, and in SAML-enforced orgs?
  (T-GNR-201, which gates the need for the REST fallback)
- ~~Does the Navigation API's `navigate` event reach Firefox content scripts?~~ Resolved 2026-11-16
  (T-GNR-106): no. Firefox delivers `turbo:load`, `wxt:locationchange` and `soft-nav:end`, but not
  `navigatesuccess` (`docs/dom-integration.md` §4).
- Does the REST fallback ship in v1, and if it does, how should AMO's data declaration be handled?
  (T-GNR-209, ADR 0003)
- Should a "compact header" option hide the commit text? (T-GNR-304)
- Firefox for Android: out of scope for v1, and its DOM is untested.

## Operating notes for Claude Code

- `to-dos/ROADMAP.md` is the authoritative plan. Ticket IDs are stable; tick acceptance criteria as
  they are met.
- `docs/` is the spec. When code and spec disagree, fix one of them in the same change.
- `ref-docs/` is immutable history. New findings go in
  `ref-docs/research-update-<YYYY-MM-DD>-<topic>.md`.
- GitHub's markup and the tree JSON are undocumented internals. Before changing a selector, capture
  a fresh fixture and note the GitHub change it tracks.
