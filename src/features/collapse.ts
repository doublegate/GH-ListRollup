/**
 * Level 1: the whole-listing collapse (T-GNR-105, T-GNR-106, T-GNR-108).
 *
 * Specs: docs/ui-behavior.md section 2, docs/dom-integration.md section 4, docs/architecture.md
 * section 3. The invariant everything here serves: the listing is never hidden without a toggle,
 * except under the bounded pre-hide (`html[data-gnr-pending]`), which every exit clears.
 */
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { findHeaderLine } from '@/github/header';
import { readListingPage } from '@/github/page';
import { classifyRows } from '@/github/rows';
import { query, queryAll } from '@/github/selectors';
import { createToggle, setToggleExpanded } from '@/ui/toggle';
import { log } from '@/log';

export const PENDING_ATTR = 'data-gnr-pending';
export const COLLAPSED_CLASS = 'gnr-collapsed';
/** Assigned to the listing container when GitHub gives it no id, for `aria-controls`. */
export const LISTING_ID = 'gnr-listing';
export const WATCHDOG_MS = 4000;
/** Re-render observer runs allowed per listing (docs/dom-integration.md section 4, step 5). */
export const RERENDER_BUDGET = 50;

export type ApplyOutcome =
  | 'applied' // the toggle is in place and the state applied
  | 'not-listing' // not a code-view listing page
  | 'no-listing' // a listing page whose listing is not in the DOM (yet)
  | 'no-header' // the confidence gate failed on the header line
  | 'stale' // the DOM still shows the previous page after a soft navigation
  | 'budget' // the re-render budget ran out on this listing: the page is left as GitHub renders it
  | 'error'; // an unexpected exception; the page is left alone

/** State of the listing currently shown, keyed by its whole `location.pathname`. */
interface ListingState {
  pathname: string;
  /** The Level 1 state the user sees once the toggle is in place. */
  expanded: boolean;
  /** Rows were visible without a toggle on this listing: no late collapse (section 4, step 5). */
  shownWithoutToggle: boolean;
  /** Whether an apply on this listing has installed the toggle. */
  installed: boolean;
  /** The first entry row's href when last read: the soft-navigation staleness check. */
  signature: string | null;
  /** Re-render observer runs so far. */
  rerenders: number;
  /** The budget ran out: the page was restored and this listing is left alone (Codex, #16). */
  exhausted: boolean;
}

export function setPending(doc: Document): void {
  doc.documentElement.setAttribute(PENDING_ATTR, '');
}

export function clearPending(doc: Document): void {
  doc.documentElement.removeAttribute(PENDING_ATTR);
}

export function isPending(doc: Document): boolean {
  return doc.documentElement.hasAttribute(PENDING_ATTR);
}

/** The first entry row's link href: identifies which page's rows are in the DOM. */
function signatureOf(listing: Element | null, owner: string, repo: string): string | null {
  if (!listing) return null;
  return classifyRows(listing, owner, repo)[0]?.href ?? null;
}

/** The nearest element containing both `a` and `b`. */
function commonAncestor(a: Element, b: Element): Element | null {
  for (let el: Element | null = a; el; el = el.parentElement) {
    if (el.contains(b)) return el;
  }
  return null;
}

export class CollapseController {
  private state: ListingState | null = null;
  private observer: MutationObserver | null = null;
  private observed: Element | null = null;
  private scheduled = false;

  constructor(
    private readonly ctx: ContentScriptContext,
    private readonly doc: Document,
    /** Called when the page should be re-applied (one animation frame later). */
    private readonly onSchedule: () => void = () => undefined,
  ) {
    ctx.onInvalidated(() => {
      this.disconnect();
      this.restore();
    });
  }

  /**
   * Leaves the page as GitHub rendered it: our toggles removed, the listing shown. Runs on teardown,
   * because a dead content script would leave the files hidden behind an inert button (Codex, #16).
   */
  restore(): void {
    for (const el of queryAll('gnrToggle', this.doc).elements) el.remove();
    query('listing', this.doc)?.element.classList.remove(COLLAPSED_CLASS);
    clearPending(this.doc);
  }

  /** Runs `apply` on the next animation frame, coalescing repeated requests. */
  schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    this.ctx.requestAnimationFrame(() => {
      this.scheduled = false;
      this.onSchedule();
    });
  }

  /** The listing state, for logging and tests. */
  get current(): Readonly<ListingState> | null {
    return this.state;
  }

  /** Idempotent: safe to call any number of times on any page state. Never throws. */
  apply(url: URL): ApplyOutcome {
    try {
      return this.applyInner(url);
    } catch (error) {
      clearPending(this.doc);
      log.warn('apply failed; leaving the page alone', error instanceof Error ? error.message : '');
      return 'error';
    }
  }

  private applyInner(url: URL): ApplyOutcome {
    const doc = this.doc;
    const page = readListingPage(url, doc);
    if (!page) {
      // Forget the listing: coming back to it later is a navigation, not a re-render (agy, #16).
      clearPending(doc);
      this.state = null;
      this.disconnect();
      return 'not-listing';
    }
    const listing = query('listing', doc)?.element ?? null;
    const signature = signatureOf(listing, page.owner, page.repo);
    const navigated = this.state?.pathname !== url.pathname;

    // Soft navigation fires before React renders the new listing (ref-docs/research-update-
    // 2026-11-16-phase1-fixtures.md section 6). A resolved ref proves the DOM belongs to this URL
    // (it passed the cross-check); otherwise rows identical to the previous page's are stale.
    if (
      navigated &&
      this.state !== null &&
      page.ref === null &&
      signature !== null &&
      signature === this.state.signature
    ) {
      return 'stale';
    }

    if (navigated || this.state === null) {
      // A different listing: reset to the default (docs/architecture.md section 3.2).
      this.state = {
        pathname: url.pathname,
        expanded: false,
        shownWithoutToggle: false,
        installed: false,
        signature,
        rerenders: 0,
        exhausted: false,
      };
    }
    const state = this.state;
    state.signature = signature;
    if (state.exhausted) return 'budget';

    if (!listing) {
      clearPending(doc);
      return 'no-listing';
    }
    const header = findHeaderLine(doc);
    if (!header) {
      // The confidence gate: leave GitHub's listing visible. If an earlier apply collapsed it and
      // the header (with our toggle) has since gone, show the files again (Codex, #16), and keep
      // them shown when the header returns: no late collapse.
      clearPending(doc);
      listing.classList.remove(COLLAPSED_CLASS);
      state.shownWithoutToggle = true;
      state.installed = false;
      // Watch for the header line arriving later: nothing else would re-apply (agy, #16). The
      // code-view app contains both the listing and the commit bar on either layout; the listing's
      // parent does not on folder pages, where the bar is a separate section (Codex, #16).
      const app = query('codeView', doc)?.element;
      this.observe(app?.contains(listing) ? app : doc.body);
      return 'no-header';
    }

    // First successful apply on this listing: no late collapse if rows were already exposed.
    if (!state.installed) {
      state.expanded = state.shownWithoutToggle;
      state.installed = true;
    }

    if (!listing.id) listing.id = LISTING_ID;
    const button = this.ensureToggle(header.insertionPoint, listing.id);
    // Order matters: the toggle is in the DOM before the hiding class is applied.
    setToggleExpanded(button, state.expanded);
    listing.classList.toggle(COLLAPSED_CLASS, !state.expanded);
    clearPending(doc);

    this.observe(commonAncestor(header.box, listing) ?? listing);
    // Our own insertion above is not a re-render: drop its records (agy, #16).
    this.observer?.takeRecords();
    return 'applied';
  }

  /** The single toggle, in the header line's inner row: reused, moved or created. */
  private ensureToggle(insertionPoint: Element, controlsId: string): HTMLButtonElement {
    const existing = queryAll('gnrToggle', this.doc).elements.filter(
      (el): el is HTMLButtonElement => el instanceof HTMLButtonElement,
    );
    const inPlace = existing.find((b) => b.parentElement === insertionPoint);
    // Remove our own extra or misplaced toggles (never GitHub's nodes).
    for (const b of existing) if (b !== inPlace) b.remove();
    if (inPlace) {
      if (insertionPoint.firstElementChild !== inPlace) insertionPoint.prepend(inPlace);
      inPlace.setAttribute('aria-controls', controlsId);
      return inPlace;
    }
    const button = createToggle(this.doc, controlsId);
    this.ctx.addEventListener(button, 'click', () => {
      this.toggle(button);
    });
    insertionPoint.prepend(button);
    return button;
  }

  /** The user's click on `button`: flips the state of the listing currently shown. */
  toggle(button: HTMLButtonElement): void {
    const state = this.state;
    const listing = query('listing', this.doc)?.element;
    if (!state || !listing) return;
    state.expanded = !state.expanded;
    setToggleExpanded(button, state.expanded);
    listing.classList.toggle(COLLAPSED_CLASS, !state.expanded);
  }

  /** Watches `root` for React replacing rows, the listing or the header (child lists only). */
  private observe(root: Element): void {
    if (this.observed === root) return;
    this.disconnect();
    this.observed = root;
    this.observer = new MutationObserver(() => {
      const state = this.state;
      if (!state) return;
      state.rerenders++;
      if (state.rerenders > RERENDER_BUDGET) {
        // Stop observing, and since nothing will notice the toggle vanishing any more, leave the
        // page as GitHub renders it rather than risk hidden files with no control (Codex, #16).
        this.disconnect();
        state.exhausted = true;
        this.restore();
        return;
      }
      this.schedule();
    });
    this.observer.observe(root, { childList: true, subtree: true });
  }

  private disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.observed = null;
  }
}
