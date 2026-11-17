# Changelog

All notable user-visible changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Project bootstrap:
  - research report and reference material (`ref-docs/`)
  - implementation specifications and ADRs (`docs/`)
  - the phase and sprint plan (`to-dos/`)
- WXT + TypeScript skeleton that builds MV3 packages for Chrome (121+) and Firefox (142+). The
  content script logs the detected GitHub page type on load and after soft navigation. No visible
  changes to GitHub yet.
- CI workflow running format, lint, type-check, unit tests, both builds and `web-ext lint`.
- Repository files:
  - README landing page with artwork in `assets/`
  - `SECURITY.md`, `PRIVACY.md`, `CODE_OF_CONDUCT.md`
  - issue template configuration and `CODEOWNERS`
  - Dependabot configuration, with grouped monthly updates
- CI: `pnpm audit` step, and a gitleaks job that scans the full git history (pinned binary,
  checksum-verified).
- Test fixtures and tooling (Phase 0 Sprint 2):
  - `pnpm fixtures:capture`, `fixtures:check` and `fixtures:report`: capture sanitized GitHub
    pages and tree JSON, detect drift, and compare selector matches.
  - Four HTML fixtures (root and folder layouts, signed in and out) and eight tree-JSON fixtures.
  - A Vitest fixture loader (`tests/helpers/fixture.ts`).
  - Fixtures are minimized to factual structure: no site chrome, READMEs or other rendered
    markdown, or icon artwork.
  - `pnpm test` checks every fixture against its sidecar SHA-256 and the current sanitizer, and
    the signed-in capture path requires every identifier of the account being replaced.
- **The listing collapse (Phase 1):** on every repository listing page, the file and folder listing
  starts collapsed to its header line, the latest-commit bar. A chevron button at the start of that
  line shows and hides it (keyboard accessible, `aria-expanded`). The state resets to collapsed on
  every navigation to a different listing and survives GitHub's re-renders. If the header line
  cannot be found, the page is left exactly as GitHub renders it.
  - No flash of the full listing, on a cold load or on an in-page navigation (back, forward and
    folder clicks). The listing is pre-hidden until its toggle is in place, bounded by a 4-second
    watchdog.
  - Never hidden without a toggle: if the commit bar disappears, the extension updates or reloads,
    the re-render budget runs out, or an internal error occurs, the files are shown again. When the
    listing disappears outside a click or back/forward navigation (for example after one of GitHub's
    keyboard shortcuts), the collapsed state is lifted until a listing returns. That listing is then
    collapsed again, with its toggle in place.
  - Verified live on github.com in Chrome and Firefox, including 20 consecutive navigations and the
    light, dark and high-contrast themes.
- GitHub page reading (Phase 1 Sprint 1), no visible change yet:
  - a single selectors module with ranked fallbacks (`src/github/selectors.ts`);
  - a page model that resolves the ref, including refs with `/`, tags and commit SHAs, without
    splitting the URL;
  - the locator for the header line the collapsed listing keeps;
  - a selector probe, logged at debug level on listing pages.
- Store release preparation (`T-GNR-501`, `T-GNR-502`):
  - extension icons (`public/icon/{16,32,48,96,128}.png`, derived from `assets/icon.png`) and
    `homepage_url` in the Chrome and Firefox manifests;
  - `SOURCE_CODE_REVIEW.md` with reproducible build and `diff -r` instructions for Mozilla Add-ons
    reviewers.

### Fixed

- The content script no longer reports an in-page anchor (`#readme`) or a README tab switch
  (`?tab=license-ov-file`) as a new page, and a bare
  `/<owner>/<repo>/tree` URL is no longer treated as a repository listing.
- Fixture sanitizing: an email address that contains the login is now fully replaced, a
  `</script>` inside a page's embedded JSON stays escaped, and a folder named `__proto__`
  survives.
- When a folder link redirects (a `/tree/master/...` link landing on `/tree/main/...`), the
  listing's chevron now works as soon as it appears. Before, the files stayed hidden and the chevron
  did nothing for up to 4 seconds (#17).
- Never hidden without a working chevron, in more cases: a second Back or click toward a folder that
  has not rendered yet, or a listing that disappears mid-navigation, no longer leaves the files
  hidden with no control (review of #19).
- Fewer 4-second waits after a navigation: going back to the listing still shown (by Back, a link to
  it, or a link that redirects to it) ends the hiding at once, and a root and its default-branch
  `/tree/<branch>` page are told apart even when the branch cannot be read from the rows (#17).
- No late collapse: when the files were already visible (a slow page load, or a listing that
  rendered after the hiding ended), the chevron arrives with the listing expanded instead of
  collapsing it under the pointer. A listing that GitHub briefly re-renders keeps your expanded or
  collapsed choice (#17).
- No leftover, inert chevron when the commit bar stops being recognised or you leave the listing
  page, and a malformed link on the page no longer causes an error on click (#17).
- Navigating between a repository's root and its `/tree/<branch>` page no longer treats the old page,
  still on screen, as the new one: the destination is collapsed as usual, not left expanded (#20).
- A navigation that never finishes rendering no longer leaves the old listing visible while its
  chevron still says "collapsed", and going Back to it no longer collapses it under the pointer
  (#20, #21).
- A navigation that is cancelled partway brings the listing back as you left it, expanded or
  collapsed, and a folder you once saw expanded after a stalled navigation is not expanded on a
  later visit, even if you go back and return within a frame (#21, #23).
- A listing GitHub briefly removes and re-adds before a navigation changes the URL is still
  recognised as the page being left, so the new page is not collapsed from the old one's rows
  (#23). The same removal after the URL has changed is a known limitation (#24): going Back can
  then hide that page for up to 4 seconds and show it without a chevron.

### Security

- ESLint now enforces the ban on parsing strings as HTML in the extension (`DOMParser`,
  `createContextualFragment`), as `docs/security-privacy.md` already required.
- Forced `minimatch` to 11.0.8 through a pnpm override, fixing GHSA-g3hv-75wg-m249 (moderate) in
  the lint tooling.
- Reviewed and documented GHSA-gcqx-w48m-w2h4 (deepmerge, low). No fix exists, and the package is
  used only at lint time, never in the shipped extension.

### Changed

- Deferred the `storage` manifest permission until Phase 3 settings (`T-GNR-301`), so `v0.1.0`
  store packages request only `host_permissions: ["https://github.com/*"]`.
- Project renamed from the working title GH-Nested-Rollup to **GH-ListRollup**. The package name,
  extension name and Firefox add-on ID (`gh-listrollup@lparobek.dev`) changed to match.
