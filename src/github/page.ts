/**
 * Page detector and page model (docs/architecture.md section 2, docs/dom-integration.md section 3).
 *
 * `detectPage` classifies a github.com URL by shape only, as a cheap pre-filter. `readListingPage`
 * (T-GNR-103) confirms the code-view DOM and resolves the ref from a row href by subtraction,
 * because a ref may contain `/` and is never split out of the URL.
 */
import { query } from './selectors';
import { readBreadcrumbPath } from './breadcrumb';
import { classifyRows } from './rows';

export type PageKind = 'repo-root' | 'repo-tree' | 'other';

export interface PageInfo {
  kind: PageKind;
  /** Present for repo pages. */
  owner?: string;
  repo?: string;
}

/**
 * First path segments that are GitHub product routes, not repository owners. Not exhaustive;
 * Phase 1 replaces the URL-only check with the DOM gate, which makes this list a pre-filter only.
 */
const RESERVED_OWNERS = new Set([
  'about',
  'apps',
  'codespaces',
  'collections',
  'enterprise',
  'explore',
  'features',
  'issues',
  'login',
  'marketplace',
  'new',
  'notifications',
  'orgs',
  'organizations',
  'pricing',
  'pulls',
  'search',
  'settings',
  'sponsors',
  'topics',
  'trending',
]);

/** Owner and repository names allowed by GitHub (docs/data-fetching.md section 2). */
const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

export function detectPage(url: URL): PageInfo {
  if (url.hostname !== 'github.com') return { kind: 'other' };

  const segments = url.pathname.split('/').filter((s) => s.length > 0);
  const [owner, repo, section] = segments;
  if (owner === undefined || repo === undefined) return { kind: 'other' };
  if (RESERVED_OWNERS.has(owner.toLowerCase())) return { kind: 'other' };
  if (!NAME.test(owner) || !NAME.test(repo)) return { kind: 'other' };

  if (section === undefined) return { kind: 'repo-root', owner, repo };
  if (section === 'tree') {
    // A bare `/tree` names no ref, so it is not a listing (bootstrap review, #8).
    if (segments.length < 4) return { kind: 'other' };
    // `/tree/<ref>` alone is the root listing at a ref; anything deeper is a folder page.
    return {
      kind: segments.length <= 4 ? 'repo-root' : 'repo-tree',
      owner,
      repo,
    };
  }
  return { kind: 'other' };
}

/**
 * Identifies a listing for navigation de-duplication: origin and path only. An in-page anchor
 * (`#readme`, bootstrap review #8) and a README tab switch (`?tab=license-ov-file`, #11) change
 * `location.href` but show the same listing. Matches the pathname-only reset rule in
 * `docs/dom-integration.md` §4.
 */
export function pageKey(url: URL): string {
  return `${url.origin}${url.pathname}`;
}

/** A listing page, read from the DOM (docs/dom-integration.md section 3). */
export interface ListingPage {
  owner: string;
  repo: string;
  /** From a row href by subtraction, never by splitting the URL. `null` when unresolved. */
  ref: string | null;
  /** `''` for the root. `null` when the folder page's breadcrumb could not be read. */
  path: string | null;
  layout: 'root' | 'folder';
}

/**
 * Reads the listing page at `url` from `doc`, or returns `null` when this is not a code-view listing
 * page at all. Never throws on unexpected markup: every step that cannot be completed leaves `ref`
 * (and, for the breadcrumb, `path`) `null`, which disables Level 2 on the page but not Level 1.
 */
export function readListingPage(url: URL, doc: Document): ListingPage | null {
  const info = detectPage(url);
  if (info.kind === 'other' || info.owner === undefined || info.repo === undefined) return null;
  // The code-view gate. Its fallback (the route-controller meta) only counts together with the
  // listing-shaped URL that detectPage has just confirmed (docs/dom-integration.md section 2).
  if (!query('codeView', doc)) return null;
  const { owner, repo } = info;

  const listing = query('listing', doc)?.element ?? null;
  const folder =
    (listing !== null && query('upTree', listing) !== null) || query('breadcrumbs', doc) !== null;
  const layout = folder ? 'folder' : 'root';
  const path = folder ? readBreadcrumbPath(doc) : '';

  let ref: string | null = null;
  if (listing !== null && path !== null) {
    ref = resolveRef(listing, owner, repo, path);
    if (ref !== null && !matchesLocation(url, owner, repo, ref, path)) ref = null;
  }
  return { owner, repo, ref, path, layout };
}

/**
 * Decodes a link's path, or returns `null` for an href that is not a valid path on github.com: an
 * absolute link to another origin is refused even if its path looks right (agy review, #14).
 */
function decodedPath(href: string): string | null {
  try {
    const url = new URL(href, 'https://github.com');
    if (url.origin !== 'https://github.com') return null;
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

/**
 * Lower-cases the owner and repo segments only: GitHub treats those case-insensitively. A trailing
 * slash is kept, so a prefix such as `/o/r/tree/` cannot match `/o/r/tree-other/` (agy, #14).
 */
function normalizeRepoPath(p: string): string {
  return p
    .split('/')
    .map((seg, i) => (i === 1 || i === 2 ? seg.toLowerCase() : seg))
    .join('/');
}

/** As `normalizeRepoPath`, for comparing whole page paths, where a trailing slash is ignored. */
function normalizePagePath(p: string): string {
  return normalizeRepoPath(p.replace(/\/+$/, ''));
}

/**
 * Steps 2 and 3 of docs/dom-integration.md section 3: the first qualifying reference row, then
 * subtraction. Ordinary folder and file rows come first; a simplified chain is the last resort.
 */
function resolveRef(listing: Element, owner: string, repo: string, path: string): string | null {
  const rows = classifyRows(listing, owner, repo).filter(
    (r) => (r.kind === 'directory' || r.kind === 'file') && r.href !== null && r.name !== null,
  );
  const ordered = [...rows.filter((r) => !r.chain), ...rows.filter((r) => r.chain)];
  for (const row of ordered) {
    const decoded = decodedPath(row.href ?? '');
    if (decoded === null) continue;
    const prefix = `/${owner}/${repo}/${row.kind === 'directory' ? 'tree' : 'blob'}/`;
    if (!normalizeRepoPath(decoded).startsWith(normalizeRepoPath(prefix))) continue;
    const rest = decoded.slice(prefix.length);
    const tail = path === '' ? (row.name ?? '') : `${path}/${row.name ?? ''}`;
    if (!rest.endsWith(`/${tail}`)) continue;
    const ref = rest.slice(0, rest.length - tail.length - 1);
    if (ref !== '') return ref;
  }
  return null;
}

/**
 * Step 4: the whole-string cross-check against the page URL. It catches rows left over from the
 * previous page after a soft navigation, and any subtraction that went wrong.
 */
function matchesLocation(
  url: URL,
  owner: string,
  repo: string,
  ref: string,
  path: string,
): boolean {
  const actual = decodedPath(url.pathname);
  if (actual === null) return false;
  const expected =
    path === ''
      ? [`/${owner}/${repo}`, `/${owner}/${repo}/tree/${ref}`]
      : [`/${owner}/${repo}/tree/${ref}/${path}`];
  return expected.some((e) => normalizePagePath(e) === normalizePagePath(actual));
}
