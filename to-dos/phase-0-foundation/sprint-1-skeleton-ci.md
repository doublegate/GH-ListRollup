# Phase 0, Sprint 1: Skeleton and CI

**Phase:** 0, Foundation
**Sprint goal:** a building, linting, testing skeleton in both browsers with CI.
**Estimated duration:** 3-5 days

## Tickets

### T-GNR-001: WXT project, pinned toolchain, manifests

**Description:** Create `package.json` with exact pinned versions, and `wxt.config.ts` with the
manifest function specified in `docs/cross-browser.md` §2: shared keys, the Firefox gecko block and
the Chrome minimum version. Add `tsconfig.json` (strict) and `.nvmrc`.

**Acceptance criteria:**

- [x] `pnpm install` runs `wxt prepare` cleanly.
- [x] `pnpm build` and `pnpm build:firefox` produce `chrome-mv3` and `firefox-mv3` (MV3 for both).
- [x] The generated Firefox manifest contains the gecko id, `strict_min_version` 142.0 and
      `data_collection_permissions.required = ["none"]`.
- [x] `pnpm lint:firefox` reports 0 errors and 0 warnings.

**Dependencies:** none | **Reference:** `docs/cross-browser.md`, `ref-docs/wxt-framework.md` | **Complexity:** S

---

### T-GNR-002: Lint, format and type gates

**Description:** ESLint flat config with type-checked rules and the HTML-sink ban from
`docs/security-privacy.md` §2, plus a Prettier config. The `typecheck` and `check` scripts.

**Acceptance criteria:**

- [x] `pnpm lint` passes with `--max-warnings 0`.
- [x] Assigning `el.innerHTML = x` in any `src/` file fails lint. Checked manually; a lint fixture
      test is added in T-GNR-405.
- [x] `pnpm format:check` passes on the whole repository (`ref-docs/` is excluded as immutable).

**Dependencies:** T-GNR-001 | **Reference:** `docs/build-and-tooling.md` §3 | **Complexity:** S

---

### T-GNR-003: Page-type detector (URL shape)

**Description:** `src/github/page.ts` `detectPage(url)` returns `repo-root`, `repo-tree` or `other`,
with owner and repo. It is pure and has unit tests.

**Acceptance criteria:**

- [x] Tests cover root, `/tree/<ref>`, folder, slash ref, blob, issues, reserved owners and invalid
      names (`tests/unit/page.test.ts`, 15 tests).

**Dependencies:** T-GNR-001 | **Reference:** `docs/dom-integration.md` §3 | **Complexity:** S

---

### T-GNR-004: Navigation wiring and logging content script

**Description:** `src/github/nav.ts` debounces `soft-nav:end`, `soft-nav:react-done`, `turbo:render`,
`turbo:load`, `popstate` and `wxt:locationchange` into one callback per frame, using
`ctx.addEventListener`. The content script logs `[gnr] page <kind> <owner> <repo>`.

**Acceptance criteria:**

- [x] Builds, and the content script matches `https://github.com/*` at `document_start`.
- [ ] Manual check in Chrome: a log line on the root page, on a folder page, and after clicking a
      folder link (soft navigation) without reload.
- [ ] The same manual check in Firefox.
- [ ] Reloading the extension leaves no duplicate log lines on the next navigation, which shows that
      `ctx` invalidation works.

**Dependencies:** T-GNR-003 | **Reference:** `docs/dom-integration.md` §4 | **Complexity:** S

---

### T-GNR-005: CI workflow

**Description:** `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile` and `pnpm check` on
Ubuntu with Node 26. Actions are pinned, and the job uploads both builds as artifacts.

**Acceptance criteria:**

- [x] Workflow file present and its YAML is valid.
- [ ] Green on the first push to the GitHub remote (needs a repository; not created yet).

**Dependencies:** T-GNR-002 | **Reference:** `docs/build-and-tooling.md` §4 | **Complexity:** S

---

## Sprint review checklist

- [ ] All tickets checked off or explicitly deferred, with the reason.
- [ ] `CHANGELOG.md` `[Unreleased]` lists the skeleton.
