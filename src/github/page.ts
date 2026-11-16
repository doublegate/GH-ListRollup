/**
 * Page detector (docs/architecture.md section 2, docs/dom-integration.md section 3).
 *
 * Phase 0 skeleton: classifies a github.com URL by shape only. Phase 1 extends this to confirm the
 * code-view DOM (`react-app[app-name="code-view"]`) and to resolve the ref from row hrefs, because a
 * ref may contain `/` and cannot be split out of the URL.
 */

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
