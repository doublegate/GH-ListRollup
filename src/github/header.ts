/**
 * Header-line locator (T-GNR-104, docs/dom-integration.md section 2.1).
 *
 * The collapsed listing keeps one line: the latest-commit bar. The toggle goes in as the first child
 * of the bar's INNER ROW, which is the bordered box's child containing the commit details. Observed
 * identically on the root page (where the box shares a parent with the listing) and on folder pages
 * (a separate box above the listing). Fixtures: `root`, `folder`, and their `-logged-in` twins.
 */
import { COMMIT_HEADING_TEXT, closest, query, queryAll } from './selectors';

export interface HeaderLine {
  /** The bar's inner row: the toggle is inserted as its first child. */
  insertionPoint: Element;
  /** The bordered box around the bar. */
  box: Element;
  rank: 'primary' | 'fallback1';
}

/** The child of `box` that contains `el` (`el` itself when it is a direct child). */
function childContaining(box: Element, el: Element): Element | null {
  for (const child of box.children) {
    if (child === el || child.contains(el)) return child;
  }
  return null;
}

function fromAnchor(anchor: Element, rank: HeaderLine['rank']): HeaderLine | null {
  const box = closest('borderedBox', anchor);
  if (!box) return null;
  const insertionPoint = childContaining(box, anchor);
  return insertionPoint ? { insertionPoint, box, rank } : null;
}

/**
 * Finds the header line, or returns `null` when neither the commit details nor the bar's
 * screen-reader heading is present inside a bordered box. A `null` is the confidence gate's cue to
 * leave the page alone (docs/dom-integration.md section 1.5).
 */
export function findHeaderLine(doc: Document): HeaderLine | null {
  const details = query('commitDetails', doc)?.element;
  if (details) {
    const found = fromAnchor(details, 'primary');
    if (found) return found;
  }
  const heading = queryAll('commitHeading', doc).elements.find(
    (h) => h.textContent?.trim() === COMMIT_HEADING_TEXT,
  );
  return heading ? fromAnchor(heading, 'fallback1') : null;
}
