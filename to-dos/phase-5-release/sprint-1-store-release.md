# Phase 5, Sprint 1: Store Release

**Phase:** 5, Release
**Estimated duration:** 1-2 weeks, mostly review wait time

## Tickets

### T-GNR-501: Store assets and policy documents

**Description:** Add icons (16, 32, 48 and 128 px) in `public/icon/`, screenshots (collapsed,
expanded, nested), store descriptions, `PRIVACY.md`, and `SOURCE_CODE_REVIEW.md`.

**Acceptance criteria:**

- [ ] Icons referenced in the manifest; `web-ext lint` clean.
- [ ] `PRIVACY.md` matches `docs/security-privacy.md` §3.

**Dependencies:** Phase 4 | **Reference:** `docs/release.md` §2-§3 | **Complexity:** M

---

### T-GNR-502: Reproducible Firefox build

**Description:** Configure `zip.includeSources` (an allowlist). Rebuild from the extracted sources
zip in a clean Ubuntu 24.04 container with AMO's Node version, and `diff -r` against the CI output.

**Acceptance criteria:**

- [ ] Zero differences. The command sequence is recorded in `SOURCE_CODE_REVIEW.md`.

**Dependencies:** T-GNR-501 | **Reference:** `docs/release.md` §3 | **Complexity:** M

---

### T-GNR-503: Release workflow

**Description:** A workflow triggered by `v*` tags. It runs the gate, `pnpm zip` and
`pnpm zip:firefox`, attaches the zips and SHA-256 checksums to a GitHub release, and refuses to run if
the release already exists.

**Acceptance criteria:**

- [ ] A dry run on `v0.9.0-rc.1` produces the release with assets.

**Dependencies:** T-GNR-502 | **Reference:** `docs/release.md` §4 | **Complexity:** M

---

### T-GNR-504: Submit and roll out

**Description:** Submit to AMO (listed), and to Chrome (trusted testers or unlisted, then public after
7 days). Optionally submit to Edge.

**Acceptance criteria:**

- [ ] Both listings live, and the store links added to `README.md`.
- [ ] `CHANGELOG.md` `[1.0.0]` dated; tag `v1.0.0` pushed.

**Dependencies:** T-GNR-503 | **Reference:** `docs/release.md` §5 | **Complexity:** S

---

## Sprint review checklist

- [ ] Release gate PASS recorded in the tag message.
