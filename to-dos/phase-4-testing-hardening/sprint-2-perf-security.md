# Phase 4, Sprint 2: Performance and Security

**Phase:** 4, Testing and hardening
**Estimated duration:** 1 week

## Tickets

### T-GNR-404: Performance budgets in CI

**Description:** Add `performance.measure('gnr:apply')` to debug builds, a Playwright assertion of
p95 under 5 ms over 20 loads, a bundle-size check under 30 KB, and an assertion that re-expansion
takes under 16 ms and makes 0 requests.

**Acceptance criteria:**

- [ ] Budgets asserted, with baseline numbers recorded in `docs/architecture.md` §5.

**Dependencies:** T-GNR-401 | **Reference:** `docs/testing-strategy.md` §6 | **Complexity:** M

---

### T-GNR-405: Security review

**Description:** Run the checklist in `docs/security-privacy.md` §4. Add a lint fixture test proving
the HTML-sink ban fires, and an E2E test that greps the console for the test token.

**Acceptance criteria:**

- [ ] Every checklist item ticked, with evidence linked in the PR.
- [ ] `pnpm audit` clean, dev dependencies included as in CI, or every ignored GHSA in
      `pnpm-workspace.yaml` re-checked (`docs/security-privacy.md` §4).

**Dependencies:** T-GNR-302 (if shipped), T-GNR-401 | **Reference:** `docs/security-privacy.md` | **Complexity:** M

---

### T-GNR-406: Accessibility pass

**Description:** Screen-reader check with NVDA or Orca on Firefox and Chrome, covering toggle
announcements, the tree group, and focus order. Fix any findings.

**Acceptance criteria:**

- [ ] Findings and fixes recorded. The axe scan from T-GNR-401 is clean.

**Dependencies:** T-GNR-208 | **Reference:** `docs/ui-behavior.md` §3.4 | **Complexity:** S

---

## Sprint review checklist

- [ ] Phase 4 exit criteria checked.
