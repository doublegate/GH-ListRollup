# Review Style Guide: GH-ListRollup

Project-specific rules for the Antigravity PR reviewer. GH-ListRollup is a Chrome and Firefox MV3
extension, built with WXT and TypeScript, that modifies github.com repository pages. These rules are
the enforceable form of `CLAUDE.md` "Hard rules" and `docs/security-privacy.md`.

## Priorities (in order)

1. **Never break GitHub's page.**
   - A listing must never be hidden unless its toggle is already in the DOM.
   - If selectors don't match, the extension does nothing.
2. **Security.**
   - Repository-controlled strings (file, folder and ref names) never become HTML.
   - No new network origins.
   - No telemetry.
3. **Correctness under GitHub's soft navigation and React re-renders.** `apply()` stays idempotent.
4. **Tests accompany behaviour changes.** The matching `docs/*.md` spec is updated in the same PR.

## What to flag as BLOCKING

- `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, or
  HTML built by string concatenation, in `src/`. (Reading `outerHTML` inside `scripts/lib/` dev
  tooling, with a justified `eslint-disable`, is allowed.)
- **Selectors:**
  - A selector string anywhere outside `src/github/selectors.ts`.
  - Use of a hashed GitHub class (`Box_*__xxxx`, `prc-*-<hash>`, `*__[A-Za-z0-9]{6}`) as a selector.
- **Removing or rewriting GitHub's own nodes or text.** The extension may only add `data-gnr` nodes
  and toggle classes.
- **Deriving a ref by splitting `location.pathname`.** Refs may contain `/`.
- **Network:** a fetch to any origin other than `github.com`, or `api.github.com` from the
  background script only.
- **Lifecycle:** a listener, observer, timer or fetch not tied to WXT's `ctx` (`ctx.addEventListener`,
  `ctx.signal`, `ctx.onInvalidated`).
- **Token handling:**
  - The optional GitHub token reaching a content script, a log line, an error message, or
    `storage.sync`.
  - Logging response bodies.
- **Manifest and dependencies:**
  - Manifest permission or host changes without a CHANGELOG entry and an update to
    `docs/cross-browser.md`.
  - A dependency version range (`^`, `~`). Versions are pinned exactly for AMO reproducible builds.
  - A new runtime dependency without an ADR.
- **Test fixtures (`tests/fixtures/`):**
  - Fixtures containing any personal data (logins other than `fixture-user`, emails, user ids),
    tokens, nonces, signed values or avatar URLs.
  - Fixtures edited by hand instead of re-captured.

## What to keep as SUGGESTION / NITPICK

- Naming, structure and readability.
- Missing tests for non-critical paths.
- Performance ideas without a measurement. The budgets are in `docs/architecture.md` §5; profile
  before optimising.
- Doc wording.

## Conventions

- **Commits:** Conventional Commits, with ticket IDs (`T-GNR-NNN`) in the body.
- **Style:** no emojis in code, comments, commits or docs.
- **Specs:** `docs/` is the spec. If code and spec disagree, one of them must change in the same PR.
- **Research:** `ref-docs/` is immutable history. New findings go in dated
  `ref-docs/research-update-*.md` files.
