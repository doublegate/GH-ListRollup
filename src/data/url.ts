/**
 * URL construction for folder fetches and entry links (T-GNR-203, docs/data-fetching.md §2,
 * docs/security-privacy.md §2.2).
 *
 * The URL parser normalizes `.` and `..` segments and `encodeURIComponent` does not encode `.`, so a
 * path such as `a/../../settings` would otherwise reach another same-origin page. Every segment is
 * therefore checked on its decoded text, encoded on its own, and the built URL is re-checked: its
 * origin must be GitHub's and its pathname must be exactly the one built. Any failure throws
 * `InvalidKeyError` before a request is made.
 */
import { InvalidKeyError } from './errors';
import type { EntryKind, FolderKey } from './types';

export const GITHUB_ORIGIN = 'https://github.com';

/** GitHub owner and repository names: letters, digits, `_`, `.` and `-`, at most 100. */
const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

function checkName(value: string, what: string): string {
  if (!NAME.test(value) || value === '.' || value === '..') {
    throw new InvalidKeyError(`${what} is not a valid GitHub name`);
  }
  return value;
}

/**
 * Splits a ref or path on `/` and encodes each segment. Empty, `.` and `..` segments are refused:
 * Git allows none of them as a path or ref component, so no real entry is lost.
 */
function encodeSegments(value: string, what: string, allowEmpty: boolean): string[] {
  if (value === '') {
    if (allowEmpty) return [];
    throw new InvalidKeyError(`${what} is empty`);
  }
  return value.split('/').map((segment) => {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new InvalidKeyError(`${what} has an empty, "." or ".." segment`);
    }
    return encodeURIComponent(segment);
  });
}

/** Joins the checked parts and verifies that the URL parser changed nothing. */
function build(owner: string, repo: string, view: 'tree' | 'blob', ref: string, path: string): URL {
  const parts = [
    checkName(owner, 'owner'),
    checkName(repo, 'repo'),
    view,
    ...encodeSegments(ref, 'ref', false),
    ...encodeSegments(path, 'path', view === 'tree'),
  ];
  const pathname = `/${parts.join('/')}`;
  const url = new URL(pathname, GITHUB_ORIGIN);
  if (url.origin !== GITHUB_ORIGIN || url.pathname !== pathname) {
    throw new InvalidKeyError('the URL parser changed the path');
  }
  if (!url.pathname.startsWith(`/${owner}/${repo}/${view}/`)) {
    throw new InvalidKeyError('the path left the repository');
  }
  return url;
}

/** The tree JSON URL for a folder (`docs/data-fetching.md` §2). Throws `InvalidKeyError`. */
export function buildTreeUrl(key: FolderKey): URL {
  return build(key.owner, key.repo, 'tree', key.ref, key.path);
}

/**
 * The link for an entry in the nested tree: folders open their `/tree/` page, everything else its
 * `/blob/` page. Throws `InvalidKeyError`.
 */
export function buildEntryHref(
  page: { owner: string; repo: string; ref: string },
  entry: { path: string; kind: EntryKind },
): string {
  const view = entry.kind === 'dir' ? 'tree' : 'blob';
  return build(page.owner, page.repo, view, page.ref, entry.path).href;
}
