# Release and Store Publishing

**Status:** Draft v0.1 (2026-11-15) | **Tickets:** Phase 5
**Sources:** `ref-docs/store-publishing.md`, `ref-docs/wxt-framework.md` (zip and AMO sources),
`ref-docs/research-report.md` §4, §7 (R7, R8)

## 1. Versioning

- Semantic versioning. `package.json` `version` is the single source of truth; WXT copies it into
  both manifests. Pre-1.0 releases are `0.x.y`.
- A tag `vX.Y.Z` is created only after the gate in §4 passes. A published version is immutable: a
  fix gets a new version, never a replaced package.

## 2. Chrome Web Store (and Edge Add-ons)

1. Run `pnpm zip`. It produces `.output/gh-listrollup-<version>-chrome.zip`.
2. Dashboard fields. Each must stay consistent with `docs/security-privacy.md` §3.
   - **Single purpose:** "Collapse and expand the file listing on GitHub repository pages, and
     expand folders inline."
   - **Permission justifications:**
     - `storage`: "Saves display preferences."
     - `https://github.com/*`: "Runs on GitHub repository pages and loads folder contents the user
       expands."
     - `https://api.github.com/*`, if shipped: "Optional fallback for loading folder contents."
   - **Remote code:** none.
   - **Privacy practices:**
     - no data collected or sold
     - if the token fallback ships, disclose "authentication information, stored locally, used only
       to call GitHub on the user's behalf"
     - Limited Use certification
     - a privacy policy URL, pointing at `PRIVACY.md` in the repository
3. Upload, then submit for review. Review usually takes days and can take weeks.
4. Edge Add-ons, optional: upload the same zip in Partner Center. There is no fee, and certification
   takes up to 7 business days.

## 3. Firefox Add-ons (AMO)

1. Run `pnpm zip:firefox`. It produces the extension zip and `...-sources.zip`. WXT 0.21's
   `zip.includeSources` is an allowlist; check the printed file list contains:
   - `src/`, `public/` (if present)
   - `package.json`, `pnpm-lock.yaml`, `wxt.config.ts`, `tsconfig.json`
   - `SOURCE_CODE_REVIEW.md`
2. `SOURCE_CODE_REVIEW.md`, added in Phase 5, gives reviewers the exact steps: Node and pnpm
   versions, `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm zip:firefox`, and where the
   output lands. AMO's default rebuild machine is Ubuntu 24.04 ARM64 with Node 24.14.0. The build
   must reproduce byte-for-byte there, so:
   - no timestamps or git hashes in the bundle
   - no `.env` files
   - the lockfile is committed
3. Before uploading, rebuild from the extracted sources zip in a clean container and `diff -r` the
   result against `.output/firefox-mv3`. Only upload if they are identical.
4. Upload as **listed**, or run
   `web-ext sign --channel listed --upload-source-code <sources.zip>`, with credentials from
   environment variables only.
5. **Data collection declaration.** The manifest declares `required: ["none"]`. AMO's revised
   policies take effect 2026-12-01 and require declarations to be accurate (risk R7).
   - **v1 ships without the token fallback:** keep `none`.
   - **The fallback ships:** decide before submission. Either keep `none`, following Refined
     GitHub's precedent and arguing that the token goes only to GitHub at the user's request, or
     declare `optional: ["authenticationInfo"]` and request consent at runtime when a token is
     saved.

   Record the choice in a new ADR.

## 4. Release gate (fail closed)

- [ ] Clean working tree on `main`; CI green on the release commit.
- [ ] `pnpm check` passes locally.
- [ ] The Chromium E2E suite and the Firefox smoke suite pass.
- [ ] The live probe passed within the last 24 hours.
- [ ] The manual checklist (`docs/testing-strategy.md` §5) is complete for both browsers.
- [ ] The security checklist (`docs/security-privacy.md` §4) is complete.
- [ ] `CHANGELOG.md`: `[Unreleased]` renamed to `[X.Y.Z] - YYYY-MM-DD`.
- [ ] The version is consistent across `package.json`, both built manifests, the README (status
      note, installation, compatibility), `SOURCE_CODE_REVIEW.md` (it names the archive files) and
      `PROJECT-STATUS.md`.
- [ ] The tag does not already exist (`git tag -l vX.Y.Z` is empty).
- [ ] The annotated tag message includes a summary, changes, the testing evidence, and the store
      submission status.

## 5. Rollout

1. Firefox listed and Chrome "unlisted" or trusted testers first.
2. After 7 days with no regression reports, publish Chrome publicly.

**Rollback criterion.** Any report of a listing hidden with no visible toggle is a severity-1 defect.
Respond by:

- re-publishing the previous version under a higher version number
- shipping a fix that disables Level 1 by default

GitHub DOM changes are expected. When the live probe fails, the response is a selector update
release, not a rollback.

## 6. Pre-1.0 store builds (0.1.x)

The 0.1.x versions ship Phase 1 to the stores before the Phase 4 suites exist, so their gate is the
part of §4 that can run today:

- `pnpm check`, CI green on the release commit;
- the live Playwright checks in `tests/e2e/manual/` (`t-gnr-109.mjs`, `flash-probe.mjs`,
  `t-gnr-004.mjs`) in place of the E2E, Firefox smoke and live-probe suites;
- the manual Firefox check on the release build;
- the AMO reproducibility check (§3, step 3), run from a clean directory;
- the CHANGELOG section dated, and the version consistent everywhere §4 lists it.

**The packages are built from a clean worktree of the release commit** (`git worktree add --detach
<dir> <commit>`, then `pnpm install --frozen-lockfile`, `pnpm zip`, `pnpm zip:firefox`), never from
the working checkout. WXT does not read `.gitignore` for the sources zip, so a gitignored local file
(a log, a key, `CLAUDE.local.md`) would otherwise be published to Mozilla's reviewers.
`zip.excludeSources` mirrors `.gitignore` as a second guard (`tests/unit/zip-config.test.ts` keeps
them in sync), and the release check confirms that every file in the sources zip is tracked by git
(0.1.1: 147 files).

The packages, checksums, store artwork and a submission guide with the listing text are assembled in
`release-builds/vX.Y.Z/` (gitignored); the packages and checksums are attached to the GitHub
release. Store screenshots are captured from the release build with
`tests/e2e/manual/store-shots.mjs` (light theme, 1280x800) and the small promo tile with
`tests/e2e/manual/promo-tile.mjs`. Store text and artwork describe only what the version does: a
feature from a later phase in a screenshot or the description breaks both stores' policies.

| Version | Date       | Content                                                   |
| ------- | ---------- | --------------------------------------------------------- |
| 0.1.0   | 2026-11-16 | Phase 1, the collapsible listing (first store build)      |
| 0.1.1   | 2026-11-21 | Collapse reliability fixes (#16 follow-ups #17, #21, #23) |
