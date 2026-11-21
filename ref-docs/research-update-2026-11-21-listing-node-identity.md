# Research update 2026-11-21: the listing container across soft navigations

**Supplements:** `github-navigation-events.md`, and `research-update-2026-11-16-phase1-fixtures.md` §6
(signals arrive before React renders the new listing)
**Ticket:** T-GNR-108 (state reset and staleness), PR #20
**Evidence:** `tests/e2e/manual/node-identity.mjs`, run in Playwright's Chromium, signed out, against
`wxt-dev/wxt` on 2026-11-21.

## Question

After a soft navigation, the controller must tell the outgoing page's rows (still in the DOM) from
the destination's. Two URLs can have identical rows: `/<o>/<r>` and `/<o>/<r>/tree/<default>`. The
ref read from the rows cannot separate them, because a bare `/<o>/<r>` URL accepts any ref in the
URL cross-check. Does React keep the old listing container when it renders the new page, or does it
create a new one?

## Method

Load `/wxt-dev/wxt/tree/main`, tag the `[data-testid="directory-content"]` element with an expando
property, click each visible link to `/wxt-dev/wxt`, wait 2.5 s, then read whether the page was a
soft navigation (a `window` expando survived) and whether the listing container is the tagged node.

## Findings

| Link (from `/tree/main` to `/<o>/<r>`) | Navigation | Listing container |
| --- | --- | --- |
| Repository link in the header navigation (first) | Full page load | New (a new document) |
| Repository link in the header navigation (second) | Soft | **New node** |
| `repo-name-link` | Soft | **New node** |

The rows were identical before and after (same first entry), but React rendered the destination
into a **new** container node.

## Consequence

The staleness check compares the listing container's node identity as well as the first row's
href: identical rows in the same node are the outgoing page; identical rows in a new node are the
destination. A resolved ref is no longer treated as proof that the DOM is current
(`docs/dom-integration.md` §4).

## Limits

- One repository, one browser (Chromium), signed out. Firefox and the reverse direction
  (`/<o>/<r>` to `/<o>/<r>/tree/<default>`; no such link was visible on the page) were not measured.
- If a future GitHub release reuses the container across routes, such a navigation would read as
  stale until the 4-second navigation watchdog, which then shows the files. Re-run the probe after
  GitHub changes its router.
