/**
 * Listing-row classification (docs/dom-integration.md section 2.2).
 *
 * A row is classified by its name link's `aria-label` suffix: `(Directory)`, `(File)`,
 * `(Submodule)`, `(Symlink to file)`. Only when the link has NO suffix at all does the folder
 * fallback apply: the directory icon AND an href under this repository's `/<o>/<r>/tree/`, compared
 * here in code. Anything else is `unknown`, which is never expandable (fail-safe).
 */
import { SIMPLIFIED_CHAIN_TITLE, closest, query, queryAll } from './selectors';

export type RowKind = 'directory' | 'file' | 'submodule' | 'symlink' | 'unknown';

export interface RowInfo {
  row: Element;
  kind: RowKind;
  /** The entry name: from the label, or the link text for the fallback. A chain's is `a/b/c`. */
  name: string | null;
  /** The name link's raw `href` attribute. */
  href: string | null;
  /** A simplified chain ("This path skips through empty directories"). */
  chain: boolean;
}

const SUFFIX = /^(.*), \(([^)]+)\)$/;

function kindOfSuffix(suffix: string): RowKind {
  if (suffix === 'Directory') return 'directory';
  if (suffix === 'File') return 'file';
  if (suffix === 'Submodule') return 'submodule';
  if (suffix.startsWith('Symlink')) return 'symlink';
  return 'unknown';
}

/** Whether `href` points under `/<owner>/<repo>/tree/` (owner and repo case-insensitive). */
function isUnderTree(href: string, owner: string, repo: string): boolean {
  try {
    const url = new URL(href, 'https://github.com');
    if (url.origin !== 'https://github.com') return false; // agy review, #14
    const p = url.pathname.toLowerCase();
    return p.startsWith(`/${owner}/${repo}/tree/`.toLowerCase());
  } catch {
    return false;
  }
}

export function classifyRow(row: Element, owner: string, repo: string): RowInfo {
  const link = query('nameLink', row)?.element ?? null;
  const href = link?.getAttribute('href') ?? null;
  const chain = link?.getAttribute('title') === SIMPLIFIED_CHAIN_TITLE;
  const label = link?.getAttribute('aria-label') ?? '';
  const m = SUFFIX.exec(label);
  if (m) {
    return { row, kind: kindOfSuffix(m[2] ?? ''), name: m[1] ?? null, href, chain };
  }
  // No suffix at all: the fail-safe folder fallback (docs/dom-integration.md section 2.2).
  const name = link?.textContent?.trim() || null;
  const folder =
    link !== null &&
    href !== null &&
    query('directoryIcon', row) !== null &&
    isUnderTree(href, owner, repo);
  return { row, kind: folder ? 'directory' : 'unknown', name, href, chain };
}

/**
 * Every entry row of `listing`, in document order, classified. The parent-directory (`..`) row is
 * excluded, which the rows fallback selector would otherwise include.
 */
export function classifyRows(listing: Element, owner: string, repo: string): RowInfo[] {
  const upTree = query('upTree', listing)?.element ?? null;
  // The upTree purpose is the parent LINK (both ranks); its row is the one to drop.
  const parentRow = upTree ? (closest('tableRow', upTree) ?? upTree) : null;
  return queryAll('rows', listing)
    .elements.filter((row) => row !== parentRow && !(upTree !== null && row.contains(upTree)))
    .map((row) => classifyRow(row, owner, repo));
}
