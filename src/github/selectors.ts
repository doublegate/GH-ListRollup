/**
 * Selectors for GitHub's code view (T-GNR-101, docs/dom-integration.md sections 1-2).
 *
 * This is the ONLY module in `src/` that may contain selector strings (a unit test enforces it).
 * Each purpose has a primary selector and ranked fallbacks, built only from stable hooks:
 * `data-testid`, ids, ARIA attributes, hand-written `react-directory-*` classes and Primer utility
 * classes. Hashed CSS-module classes (`Box_3__eg9tXU`, `prc-*-<hash>`) are never used.
 *
 * Some purposes need a check that a selector cannot express (an `aria-label` suffix, a link prefix
 * built from the page's owner and repo, an element's text). Those checks live in the modules that
 * use these selectors, and are listed in `docs/dom-integration.md` section 2.
 */

/** A purpose's selectors, primary first. */
export interface RankedSelector {
  readonly primary: string;
  readonly fallbacks: readonly string[];
}

/** Which rank matched: `primary`, `fallback1`, `fallback2`, ..., or `none`. */
export type Rank = 'primary' | `fallback${number}` | 'none';

export const SELECTORS = {
  /** Code-view page gate. The fallback is a page-level hint, combined with the URL shape in code. */
  codeView: {
    primary: 'react-app[app-name="code-view"]',
    fallbacks: ['meta[name="route-controller"][content="files"]'],
  },
  /** The listing container that collapses. */
  listing: {
    primary: '[data-testid="directory-content"]',
    fallbacks: ['table[aria-labelledby="folders-and-files"]'],
  },
  /** Listing rows, queried inside the listing container. The fallback also matches the parent row. */
  rows: {
    primary: 'tbody > tr.react-directory-row',
    fallbacks: ['tr[id^="folder-row-"]'],
  },
  /**
   * The parent-directory (`..`) link on folder pages, queried inside the listing container. The
   * fallback is its ARIA label, a positive mark of the parent row: hooks defined by absence
   * (`tr:not(.react-directory-row)`) also match the root's "View all files" row, or, once GitHub
   * drops that class, every entry row (Codex review, #14).
   */
  upTree: {
    primary: 'a[data-testid="up-tree"]',
    fallbacks: ['a[aria-label="Parent directory"]'],
  },
  /** Any table row: used with `closest()` to go from a link to its row. */
  tableRow: {
    primary: 'tr',
    fallbacks: [],
  },
  /** A row's name link, queried inside a row. The first match is the small-screen cell's link. */
  nameLink: {
    primary: '.react-directory-filename-cell a',
    fallbacks: ['.react-directory-truncate a'],
  },
  /** A row's name cells (two per row: small and large screen), queried inside a row. */
  nameCells: {
    primary:
      'td.react-directory-row-name-cell-small-screen, td.react-directory-row-name-cell-large-screen',
    fallbacks: ['.react-directory-filename-column'],
  },
  /** The directory icon inside a row: the folder fallback when GitHub drops the label suffixes. */
  directoryIcon: {
    primary: 'svg.octicon-file-directory-fill',
    fallbacks: [],
  },
  /**
   * The breadcrumb on folder pages. Two exist (header and sticky); the first is used. The id
   * fallbacks exist only on folder pages (verified on every fixture, root ones included): with the
   * parent link this is a folder page's evidence, and losing both would misread it as a root
   * (agy review, #14).
   */
  breadcrumbs: {
    primary: '[data-testid="breadcrumbs"]',
    fallbacks: ['#repos-header-breadcrumb', '#sticky-breadcrumb'],
  },
  /** Inside the breadcrumb: one link per folder level. The repository link comes first. */
  breadcrumbLinks: {
    primary: 'ol > li > a',
    fallbacks: [],
  },
  /** Inside the breadcrumb: the repository link, which is not a path segment. */
  breadcrumbRepoLink: {
    primary: '[data-testid="breadcrumbs-repo-link"]',
    fallbacks: ['ol > li:first-child > a'],
  },
  /** The current folder's name, after the breadcrumb. Folder pages only. */
  breadcrumbFilename: {
    primary: '[data-testid="breadcrumbs-filename"] h1',
    // The header breadcrumb's heading, then the sticky breadcrumb's own copy (agy review, #14).
    fallbacks: ['h1#file-name-id', 'h1#sticky-file-name-id'],
  },
  /** The latest-commit bar's details. Its parent's parent is the bar's inner row. */
  commitDetails: {
    primary: '[data-testid="latest-commit-details"]',
    fallbacks: [],
  },
  /**
   * The bar's screen-reader heading ("Latest commit", matched by text in code): the header-line
   * fallback. Its parent is the same inner row.
   */
  commitHeading: {
    primary: 'h2[data-testid="screen-reader-heading"]',
    fallbacks: ['h2.sr-only'],
  },
  /** The bordered box around the commit bar: Primer's `border` utility class, not a hashed one. */
  borderedBox: {
    primary: '.border',
    fallbacks: [],
  },
  /** The mobile-only "View all files" row. */
  viewAllRow: {
    primary: 'tr[data-testid="view-all-files-row"]',
    fallbacks: [],
  },
} as const satisfies Record<string, RankedSelector>;

export type Purpose = keyof typeof SELECTORS;

/** The commit heading's text. A text match is the last-resort hook (docs/dom-integration.md §1). */
export const COMMIT_HEADING_TEXT = 'Latest commit';

/** A simplified chain's link `title` (docs/dom-integration.md section 2.2). */
export const SIMPLIFIED_CHAIN_TITLE = 'This path skips through empty directories';

function selectorsOf(purpose: Purpose): readonly string[] {
  const s: RankedSelector = SELECTORS[purpose];
  return [s.primary, ...s.fallbacks];
}

function rankAt(index: number): Rank {
  return index === 0 ? 'primary' : `fallback${index}`;
}

/** The first element matching `purpose` under `root`, trying each rank in order. */
export function query(
  purpose: Purpose,
  root: ParentNode,
): { element: Element; rank: Exclude<Rank, 'none'> } | null {
  const all = selectorsOf(purpose);
  for (let i = 0; i < all.length; i++) {
    const element = root.querySelector(all[i] ?? '');
    if (element) return { element, rank: rankAt(i) as Exclude<Rank, 'none'> };
  }
  return null;
}

/** Every element matching the first rank of `purpose` that matches anything under `root`. */
export function queryAll(purpose: Purpose, root: ParentNode): { elements: Element[]; rank: Rank } {
  const all = selectorsOf(purpose);
  for (let i = 0; i < all.length; i++) {
    const elements = [...root.querySelectorAll(all[i] ?? '')];
    if (elements.length > 0) return { elements, rank: rankAt(i) };
  }
  return { elements: [], rank: 'none' };
}

/**
 * The first element matching `purpose` under `root` that also passes `accept`, trying each rank in
 * order. A rank whose matches all fail `accept` falls through to the next one, so unrelated
 * elements at a higher rank cannot hide a usable fallback (Codex review, #14).
 */
export function queryWhere(
  purpose: Purpose,
  root: ParentNode,
  accept: (el: Element) => boolean,
): { element: Element; rank: Exclude<Rank, 'none'> } | null {
  const all = selectorsOf(purpose);
  for (let i = 0; i < all.length; i++) {
    const element = [...root.querySelectorAll(all[i] ?? '')].find(accept);
    if (element) return { element, rank: rankAt(i) as Exclude<Rank, 'none'> };
  }
  return null;
}

/** The nearest ancestor of `el` (or `el` itself) matching `purpose`, trying each rank in order. */
export function closest(purpose: Purpose, el: Element): Element | null {
  for (const selector of selectorsOf(purpose)) {
    const found = el.closest(selector);
    if (found) return found;
  }
  return null;
}

/** Whether `el` matches any rank of `purpose`. */
export function matches(purpose: Purpose, el: Element): boolean {
  return selectorsOf(purpose).some((s) => el.matches(s));
}
