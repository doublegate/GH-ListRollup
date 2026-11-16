# Phase 4, Sprint 1: E2E Suites

**Phase:** 4, Testing and hardening
**Estimated duration:** 1 week

## Tickets

### T-GNR-401: Playwright Chromium harness and PR journeys

**Description:** Add `@playwright/test` 1.65.1 and a persistent-context fixture that loads
`.output/chrome-mv3` (`channel: 'chromium'`, headless). Route `https://github.com/**` to fixtures, and
implement the six journeys in `docs/testing-strategy.md` §4. Add an axe-core scan of the listing.

**Acceptance criteria:**

- [ ] All journeys green headless locally and in CI.
- [ ] CI job added after `build`.

**Dependencies:** Phase 3 | **Reference:** `docs/testing-strategy.md` §4, `ref-docs/testing-extensions.md` Layer 2 | **Complexity:** L

---

### T-GNR-402: Firefox smoke suite

**Description:** Using WebdriverIO with BiDi `webExtension.install`, or `playwright-webextext` if
that proves simpler, load `.output/firefox-mv3` temporarily. Assert that the page injects, the
listing collapses, and the extension survives one soft navigation.

**Acceptance criteria:**

- [ ] Nightly workflow green for 5 consecutive runs.
- [ ] The tool choice recorded in `docs/testing-strategy.md`.

**Dependencies:** T-GNR-401 | **Reference:** `ref-docs/testing-extensions.md` Layer 3 | **Complexity:** M

---

### T-GNR-403: Weekly live probe

**Description:** A scheduled workflow runs `probe()` and one live soft-navigation journey against
fixed public repositories. It opens or updates an issue labelled `selector-drift` on failure, and
skips honestly when GitHub is unreachable.

**Acceptance criteria:**

- [ ] Verified with a deliberately broken primary selector on a test branch.

**Dependencies:** T-GNR-102, T-GNR-401 | **Reference:** `docs/dom-integration.md` §6 | **Complexity:** M

---

## Sprint review checklist

- [ ] CI time on PRs stays under 10 minutes.
