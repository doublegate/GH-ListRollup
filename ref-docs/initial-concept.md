# GH-ListRollup: Initial Concept

**Date:** 2026-11-15
**Status:** Concept, approved for research and bootstrap

**Name:** the working title was GH-Nested-Rollup. The public repository and the product are named
**GH-ListRollup** (`doublegate/GH-ListRollup`), and the local working folder keeps its original name.

## Original request (verbatim)

> Initial Project Contents: create an inital Markdown project concept document in 'ref-docs/' to take
> any of the nested folder/files on the listings of GitHub repos and create a Chrome/Firefox browser
> extension to intercept the page contents, allowing for the listings to be minimized (default) with a
> drop-down/expansion arrow to show the full project repo's normal default view --> research everything
> necessary on GitHub, Chrome and Firefox browser extension documents, and elsewhere on the Internet for
> everything needed to accomplish this --> any reference content discovered should be saved in new
> Markdown documents, or their original PDFs, in 'ref-docs/' --> create any new Markdown documents
> required to fully specify and technically detail this project and its development in 'docs/' -->
> project Phase/Sprint plan TODOs should be created in 'to-dos/' --> generate any other files necessary
> to fully produce this project, as needed / useful

## Clarification (verbatim)

> for #1 the folders inside a repo's folder/file listing (to expand in place as a nested tree), but also
> the whole entire folder/files list itself should be allowed to be collapsed into just a single-line
> (the header) to save space and not show any of them (that was the default minimized/collapsed behavior
> I was calling for) ... folders that are allowed to be expanded in place as a nested tree, should
> similarly start out as collapsed, not expanded

## Behavior

The extension changes the repository code view on `github.com` at two levels.

### Level 1: whole-listing collapse

- Applies to **every page that shows a folder and file listing**: the repository main page
  (`/<owner>/<repo>`, `/<owner>/<repo>/tree/<ref>`) and every folder page (`/<owner>/<repo>/tree/<ref>/<path>`).
- The listing **starts collapsed** to its single header line, the row holding the branch picker,
  "Go to file" and "Code", or the latest-commit bar, depending on the layout found in research.
- An arrow on the header expands the listing to GitHub's normal view. Clicking it again collapses it.
- Content below the listing, such as the README, stays visible, so a collapsed listing brings the
  README up the page.

```text
[>] main  12 branches  Go to file  Code            <- collapsed (default)
README.md
...

[v] main  12 branches  Go to file  Code            <- expanded
    > .github/
    > src/
      README.md
      LICENSE
```

### Level 2: inline nested folder tree

- In the expanded listing, each **folder row gets an expansion arrow**.
- Folders **start collapsed**.
- Expanding a folder inserts its children directly beneath it, indented one level, instead of loading
  the folder page. Expansion is recursive, so folders inside it can be expanded in turn.
- Clicking the folder **name** keeps GitHub's normal behavior and opens the folder page; only the
  arrow expands in place.
- Children are fetched only when a folder is first expanded, then cached for the rest of the page view.

## Decisions

| Topic | Decision |
|---|---|
| Browsers | Chrome (and other Chromium browsers) and Firefox, Manifest V3 |
| Toolchain | WXT + TypeScript, one codebase, two browser builds |
| License | `MIT OR Apache-2.0` (dual) |
| First pass | Research, specs, TODOs, and a building, logging-only skeleton with no rollup feature yet |
| Permissions | `github.com` only; no telemetry |

## Non-goals (v1)

- GitHub Enterprise Server hosts (possible later via optional host permissions).
- Changing the file viewer (`/blob/` pages), pull request file trees, or GitHub's own sidebar file
  tree.
- Lists of repositories (profile/org Repositories tabs, search results). This was considered and set
  aside during clarification.
- Editing, renaming or any write operation on repositories.
