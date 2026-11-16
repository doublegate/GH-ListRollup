# Glossary

| Term                 | Meaning in this project                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Listing**          | GitHub's folder and file table on a repository code-view page (`[data-testid="directory-content"]`).                          |
| **Header line**      | The single line that remains visible when the listing is collapsed: the latest-commit bar directly above the rows.            |
| **Level 1**          | Collapsing or expanding the whole listing.                                                                                    |
| **Level 2**          | Expanding a folder row in place as a nested tree.                                                                             |
| **Inline row**       | An extension-owned `<tr data-gnr-row>` inserted beneath a folder row to show one child.                                       |
| **Simplified chain** | A GitHub row that displays a chain of single-child folders (`a/b/c`) as one entry; JSON `hasSimplifiedPath`.                  |
| **Code view**        | GitHub's React application for repository browsing (`react-app[app-name="code-view"]`).                                       |
| **Soft navigation**  | GitHub page changes without a full load, through Turbo or the React router, announced with `soft-nav:*` and `turbo:*` events. |
| **Tree JSON**        | The response of `GET /<o>/<r>/tree/<ref>/<path>` with `Accept: application/json`.                                             |
| **Ref**              | A branch, tag or commit SHA. It may contain `/`.                                                                              |
| **Probe**            | The selector diagnostic that reports which rank of each selector matched (`docs/dom-integration.md` §6).                      |
| **Isolated world**   | The JavaScript environment of a content script. It shares the DOM with the page but not the page's globals.                   |
| **MV3**              | Manifest V3, the current extension platform version for Chrome and Firefox.                                                   |
| **WXT**              | The Vite-based framework that builds this extension for both browsers.                                                        |
| **AMO**              | addons.mozilla.org, Firefox's add-on store and signing service.                                                               |
| **CWS**              | The Chrome Web Store.                                                                                                         |
| **Primer**           | GitHub's design system. Its CSS custom properties supply all colors used here.                                                |
| **`gnr`**            | The project's prefix for attributes (`data-gnr`), classes (`gnr-`), log lines (`[gnr]`) and message types (`gnr/`).           |
