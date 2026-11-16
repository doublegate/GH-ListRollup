# UI Behavior Specification

**Status:** Draft v0.1 (2026-11-15) | **Tickets:** Phase 1 and Phase 2 in `to-dos/ROADMAP.md`
**Sources:** `ref-docs/initial-concept.md` (the behavior), `ref-docs/research-report.md` §2 (the DOM it
attaches to)

This document is the behavioral contract. When code and this document disagree, fix one of them in the
same change; tests in `tests/` are the executable form of these rules.

## 1. Scope

| Page            | URL shape                             | Level 1 (listing collapse) | Level 2 (inline tree) |
| --------------- | ------------------------------------- | -------------------------- | --------------------- |
| Repository root | `/<owner>/<repo>`                     | yes                        | yes                   |
| Root at a ref   | `/<owner>/<repo>/tree/<ref>`          | yes                        | yes                   |
| Folder page     | `/<owner>/<repo>/tree/<ref>/<path>`   | yes                        | yes                   |
| File page       | `/<owner>/<repo>/blob/...`            | no                         | no                    |
| Everything else | issues, PRs, settings, lists of repos | no                         | no                    |

`<ref>` may contain slashes (`feature/x`). The page detector must not parse the ref out of the URL; it
reads ref and path from the page's own data (see `docs/dom-integration.md` §3).

## 2. Level 1: whole-listing collapse

### 2.1 States

| State                 | What is visible                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collapsed` (default) | Only the listing's header line, with the toggle arrow at its leading edge. The header line is the latest-commit bar, which sits directly above the rows on both layouts (`docs/dom-integration.md` §2.1). All file and folder rows, and the "View all files" footer, are hidden. The branch-picker row above stays as GitHub renders it. |
| `expanded`            | GitHub's normal listing, plus the Level 2 arrows on folder rows.                                                                                                                                                                                                                                                                         |

- Every listing page load and every soft navigation to a listing page starts `collapsed` unless the
  per-repo memory setting is on and holds a remembered state (`docs/settings.md`).
- Collapsing hides rows with a class on the listing container (`display: none` via an injected
  stylesheet). It never removes GitHub's nodes, so GitHub's React tree stays consistent.
- Everything outside the listing (README, About sidebar, releases) is untouched. With the listing
  collapsed, the README moves up the page; that is the space saving the feature exists for.

### 2.2 The toggle

- One button, inserted as the first child of the header line, containing a chevron icon
  (right-pointing when collapsed, down-pointing when expanded), rotated with a CSS transform with a
  150 ms transition. `prefers-reduced-motion: reduce` disables the transition.
- `aria-expanded` mirrors the state; `aria-controls` points at the listing container's id (assigned by
  the extension if GitHub gives none: `gnr-listing`, since GitHub's container has no id); accessible
  name "Show files" / "Hide files", which is also the button's tooltip (`title`).
- Activated by click, Enter or Space. Clicks on GitHub's own header controls (branch picker, "Go to
  file", "Code") are never intercepted.
- A count badge after the arrow in the collapsed state, such as "42 items", is optional (Phase 3,
  setting-controlled) and shown only when the count is known from page data.

### 2.3 Failure behavior

If the header cannot be identified with confidence, the extension does nothing on that page: GitHub's
listing stays as GitHub renders it. Hiding a listing with no way to show it again is the worst failure
mode and must be impossible by construction. The toggle is inserted **before** the hiding class is
applied, and the class is applied only after the toggle is in the DOM.

The one exception is the anti-flash pre-hide in §4, which hides rows before the toggle exists. It is
bounded. Every path that ends without a toggle removes it at once, including a failed header check.
The 4-second watchdog removes it in every other case (`docs/dom-integration.md` §4).

## 3. Level 2: inline nested folder tree

### 3.1 Affordance

- Each folder row in the expanded listing gets an arrow button immediately before the folder icon.
  File rows get an equal-width spacer so names stay aligned. GitHub renders two name cells per row,
  one for small screens and one for large, so the arrow goes in both. The parent-directory (`..`) row
  gets nothing.
- Folders start `collapsed`. Expanded state is not remembered across navigations in v1.
- Clicking the arrow toggles inline expansion. Clicking the folder **name** keeps GitHub's normal
  link behavior (navigates to the folder page). Middle-click and Ctrl/Cmd-click on the name are
  untouched.
- GitHub's "collapsed folder" rows (a single-child chain displayed as `a/b/c`) expand to the deepest
  folder in the chain.

### 3.2 Expansion

1. On first expand, the row shows a loading state (spinner in place of the chevron, `aria-busy="true"`).
2. Children are fetched (`docs/data-fetching.md`) and inserted as extension-owned rows directly after the
   folder row, in GitHub's order: folders first, then files, case-insensitive by name.
3. Child rows show icon, name (a link to the GitHub blob/tree URL), and, if the data source provides it,
   nothing else in v1. Last-commit message and date columns are left blank for inline rows; fetching
   them per row would multiply requests.
4. Indentation: 16 px per depth level applied to the name cell. Depth is unbounded; past depth 8 the
   indent stops growing and a depth number shows in the row's tooltip.
5. Collapsing hides descendants but keeps them in the DOM and cache, so re-expanding is instant.
6. If a folder has more than 1,000 children, the first 1,000 are inserted, followed by a
   "Show all N items on GitHub" link row pointing at the folder page.

### 3.3 Errors

| Condition                   | Row shown under the folder                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network or HTTP error       | "Could not load folder contents. Retry" (Retry button re-fetches)                                                                                                |
| Folder not found (404)      | "Folder not found (it may have moved). Open on GitHub"; from the REST fallback with no token saved it adds "Private repositories need a token (see the options)" |
| Refused request key         | "Could not load folder contents. Open on GitHub" (no request is sent; `docs/data-fetching.md` §2)                                                                |
| Rate limited (fallback API) | "GitHub API rate limit reached. Opens folder page instead" (link)                                                                                                |
| Empty folder                | "This folder is empty" (rare, possible via submodule or permissions)                                                                                             |
| Submodule                   | No arrow; GitHub's submodule link is left as-is                                                                                                                  |
| Symlink to folder           | No arrow in v1                                                                                                                                                   |

### 3.4 Keyboard and ARIA

The extension-owned subtree follows the WAI-ARIA tree view pattern as far as GitHub's table markup
allows:

- Arrow buttons are real `<button>` elements with `aria-expanded` and an accessible name
  "Expand <folder>" / "Collapse <folder>".
- Child row containers get `role="group"`.
- Right Arrow on a focused collapsed arrow button expands it; Left Arrow collapses it, or, if it is
  already collapsed, moves focus to the parent folder's arrow. Up/Down move between arrow buttons and
  links in visual order. Tab order is otherwise the browser's.
- Focus is never moved by an expand/collapse triggered by mouse.

## 4. Visual design

- All colors come from GitHub's Primer CSS custom properties (`--fgColor-muted`, `--bgColor-muted`,
  `--borderColor-default`, and so on), so light, dark, dimmed and high-contrast themes work without
  per-theme code. Fallback literal colors are given only as `var(--x, fallback)`.
- Icons are inline SVG copies of Primer Octicons (`chevron-right`, `chevron-down`,
  `file-directory-fill`, `file`), MIT-licensed; the license is reproduced in `NOTICE`.
- Hover and focus-visible outlines follow GitHub's `--focus-outlineColor`.
- No flash of the full listing on load. While `html[data-gnr-pending]` is set, the manifest stylesheet
  hides listing rows. The attribute is set at `document_start` on URLs with a listing shape. It is
  removed after the first apply installs the toggle, immediately by any apply that ends without a
  toggle, or by a 4-second watchdog (`docs/dom-integration.md` §4). This keeps the §2.3 rule that a
  hidden listing is always recoverable.
- When the Level 1 state resolves to `expanded` (Phase 3 settings), the rows are hidden only until
  the settings read returns, normally a few milliseconds and never longer than the watchdog. On such
  a page the rows appear after that short delay rather than at first paint.

## 5. Interaction with other extensions

Refined GitHub, Octotree and similar extensions also modify these pages. Our nodes carry a
`data-gnr` attribute and our CSS is scoped to `[data-gnr]` and our container class, so neither side
styles the other's nodes. Known conflicts are tracked in `docs/dom-integration.md` §7.
