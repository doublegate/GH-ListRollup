# Phase 3, Sprint 2: Resilience and Fallback

**Phase:** 3, Settings and resilience
**Sprint goal:** graceful degradation for DOM and JSON changes.
**Estimated duration:** 1 week

## Tickets

### T-GNR-302: REST fallback in the background (if ADR 0003 keeps it)

**Description:** A `gnr/list` message handler in `src/entrypoints/background.ts`. It validates the
sender and the message, calls the REST Contents API, uses the token from `storage.local` when one is
set, and backs off on rate limits. Add the `https://api.github.com/*` host permission, and the token
field with its "Test token" button on the options page.

**Acceptance criteria:**

- [ ] Unit tests: sender validation, URL building (the dot-segment rule and the
      `/repos/<owner>/<repo>/contents/` prefix check), the rate-limit backoff driven by fake headers.
- [ ] A fallback `404` with no token saved shows the "Private repositories need a token" hint.
- [ ] A test proves the token never appears in a message to the content script, nor in any log line.
- [ ] `docs/cross-browser.md` §2 and `docs/release.md` §3 step 5 updated; the AMO declaration
      decision made.

**Dependencies:** T-GNR-209, T-GNR-301 | **Reference:** `docs/data-fetching.md` §4, `docs/security-privacy.md` §2.4-§2.5 | **Complexity:** L

---

### T-GNR-305: Selector fallback hardening

**Description:** Run every Phase 1 and Phase 2 behaviour against `root-stripped.html` and
`folder-stripped.html`. Confirm the confidence gate leaves the page untouched when nothing matches.

**Acceptance criteria:**

- [ ] Tests pass on the stripped fixtures.
- [ ] A test proves that the "no match" case leaves zero `[data-gnr]` nodes and visible rows.

**Dependencies:** T-GNR-102 | **Reference:** `docs/dom-integration.md` §1.5 | **Complexity:** M

---

### T-GNR-306: Coexistence check with Refined GitHub

**Description:** Install Refined GitHub with this extension in both browsers and run the manual
checklist. File and fix any conflict.

**Acceptance criteria:**

- [ ] Findings recorded in `docs/dom-integration.md` §7.

**Dependencies:** Phase 2 | **Reference:** `docs/dom-integration.md` §7 | **Complexity:** S

---

## Sprint review checklist

- [ ] Phase 3 exit criteria checked.
