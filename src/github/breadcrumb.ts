/**
 * Folder-page path from the breadcrumb (T-GNR-103, docs/dom-integration.md section 3, step 1).
 *
 * Observed structure (fixture `folder-deep`, 2026-11-16): `nav > ol > li > a`, where the first link
 * is the repository (`breadcrumbs-repo-link`) and each further link is one parent folder; the
 * current folder's name is the `h1` in `breadcrumbs-filename`, after the nav. For
 * `contrib/completion`: links `git`, `contrib`, then the heading `completion`.
 */
import { query, queryAll } from './selectors';

/**
 * The folder path, such as `contrib/completion`, or `null` when the breadcrumb is missing or does
 * not have the observed shape. Never `''`: the root has no breadcrumb and is handled by the caller.
 */
export function readBreadcrumbPath(doc: Document): string | null {
  const nav = query('breadcrumbs', doc)?.element;
  if (!nav) return null;
  const links = queryAll('breadcrumbLinks', nav).elements;
  const repoLink = query('breadcrumbRepoLink', nav)?.element;
  if (!repoLink || links[0] !== repoLink) return null;

  const current = query('breadcrumbFilename', doc)?.element.textContent?.trim() ?? '';
  if (current === '') return null;
  const parents = links.slice(1).map((a) => a.textContent?.trim() ?? '');
  if (parents.some((p) => p === '')) return null;
  return [...parents, current].join('/');
}
