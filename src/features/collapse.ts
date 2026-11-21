/**
 * Level 1: the whole-listing collapse (T-GNR-105, T-GNR-106, T-GNR-108).
 *
 * Specs: docs/ui-behavior.md section 2, docs/dom-integration.md section 4, docs/architecture.md
 * section 3. The invariant everything here serves: the listing is never hidden without a toggle,
 * except under the bounded pre-hide (`html[data-gnr-pending]`), which every exit clears.
 */
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { findHeaderLine } from '@/github/header';
import { detectPage, listingPath, readListingPage } from '@/github/page';
import { classifyRows } from '@/github/rows';
import { query, queryAll } from '@/github/selectors';
import { createToggle, setToggleExpanded } from '@/ui/toggle';
import { log } from '@/log';

export const PENDING_ATTR = 'data-gnr-pending';
/**
 * The collapsed marker, on <html> rather than the listing container: React owns the container's
 * `class` and replaces the element during hydration, which dropped a class there and flashed the
 * listing for a frame (observed live, 2026-11-16, maintainer check on #16). CSS hides any listing
 * container under `html[data-gnr-collapsed]`, whatever React does to it.
 */
export const COLLAPSED_ATTR = 'data-gnr-collapsed';
/** Assigned to the listing container when GitHub gives it no id, for `aria-controls`. */
export const LISTING_ID = 'gnr-listing';
export const WATCHDOG_MS = 4000;
/** Re-render observer runs allowed per listing (docs/dom-integration.md section 4, step 5). */
export const RERENDER_BUDGET = 50;
/** Signals that a navigation has finished (not merely started): see `navigationSignal`. */
const COMPLETION_SIGNALS: ReadonlySet<string> = new Set([
  'soft-nav:end',
  'turbo:load',
  'navigatesuccess',
]);

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
  /**
   * The listing container when last read. Equal rows count as stale only in the SAME node: React
   * renders a new container for a new page, and `/o/r` and `/o/r/tree/<default>` have identical
   * rows (with no resolvable ref, they read as stale until the watchdog otherwise; agy, #17).
   */
  node: Element | null;
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

export function setCollapsed(doc: Document, collapsed: boolean): void {
  // Plain set/remove: the "show" direction must be the simplest possible operation, because it is
  // the recovery path of every failure.
  if (collapsed) doc.documentElement.setAttribute(COLLAPSED_ATTR, '');
  else doc.documentElement.removeAttribute(COLLAPSED_ATTR);
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
  /** Increments per navigation pre-hide; only the latest navigation's watchdog acts. */
  private navigation = 0;
  /** An in-page navigation pre-hide is in flight (set by navigationStarting, ended by its outcome). */
  private navigating = false;
  /**
   * The listing shown when that navigation started (`listingPath`), or null if none was. An apply
   * on that page is a re-render of the outgoing page and keeps the pre-hide; a successful apply on
   * any other listing ends it. Not the clicked URL: GitHub may redirect or canonicalize it
   * (`/tree/master/docs` to `/tree/main/docs`), and the toggle must work there at once (agy, #17).
   */
  private navOrigin: string | null = null;
  /** The listing container the extension gave `LISTING_ID`, so teardown can take it back. */
  private assignedId: Element | null = null;
  /**
   * A listing whose files a watchdog showed before any state existed for it: its first state
   * starts as shown without a toggle, so there is no late collapse (Codex, #17).
   */
  private exposedPath: string | null = null;

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
    this.removeToggles();
    setCollapsed(this.doc, false);
    clearPending(this.doc);
    if (this.assignedId?.id === LISTING_ID) this.assignedId.removeAttribute('id');
    this.assignedId = null;
    if (this.state) this.state.installed = false;
  }

  /**
   * Where to watch for a listing or header that has not rendered yet: the code-view app, or the
   * body when the gate matched through its `<meta>` fallback, which sits in the head and could
   * never see the listing arrive (Codex, #16).
   */
  private observationRoot(): Element {
    const app = query('codeView', this.doc)?.element;
    return app && this.doc.body.contains(app) ? app : this.doc.body;
  }

  /**
   * Whether the listing `path` has a working toggle right now: installed by an apply on it AND
   * still in the DOM. `installed` alone is not enough mid-navigation, where React may already have
   * removed the header line (agy, post-merge review of #19).
   */
  private toggleLive(path: string): boolean {
    return (
      this.state?.installed === true &&
      this.state.pathname === path &&
      queryAll('gnrToggle', this.doc).elements.length > 0
    );
  }

  /**
   * A navigation (Back, or a click on a link to the listing still shown) returns to `path` before
   * the destination rendered. If `path` still has a working toggle, end the in-flight pre-hide
   * instead of leaving it to the watchdog (agy, #19); otherwise the watchdog keeps it bounded.
   */
  returningTo(path: string): void {
    if (!this.navigating) return;
    if (!this.toggleLive(path)) {
      // No working toggle yet (React replaced the commit bar; the apply that installs a new one is
      // a frame away). The navigation is back on `path`, so an apply there is no longer an outgoing
      // re-render: let the next successful apply end the pre-hide, as on any destination. The
      // watchdog still bounds it (agy, #20, blocking).
      if (path === this.navOrigin) this.navOrigin = null;
      return;
    }
    this.navigation++; // the in-flight watchdog no longer acts
    this.navigating = false;
    clearPending(this.doc);
  }

  /** Removes the extension's own toggles (never GitHub's nodes). */
  private removeToggles(): void {
    for (const el of queryAll('gnrToggle', this.doc).elements) el.remove();
  }

  /**
   * A watchdog has just shown the files of the listing at `location` without a toggle. Record it,
   * so a toggle installed later does not collapse what the user can already see (Codex, #17).
   */
  private markExposed(): void {
    const here = listingPath(this.doc.location.pathname);
    if (this.state?.pathname === here) {
      // Callers have checked that no working toggle exists, whatever `installed` still says: a
      // stale flag would skip the exposure and collapse the visible files later (agy, #20).
      this.state.installed = false;
      this.state.shownWithoutToggle = true;
    } else {
      this.exposedPath = here;
    }
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
      // Leave the page as GitHub renders it. With the collapsed marker on <html>, clearing only
      // the pending attribute would keep the files hidden without a toggle (agy, #16).
      try {
        this.restore();
      } catch {
        // Best effort; the marker and pending removal above are plain attribute removals.
        setCollapsed(this.doc, false);
        clearPending(this.doc);
      }
      this.navigating = false;
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
      setCollapsed(doc, false); // only listing pages carry the marker
      this.removeToggles(); // none may stay behind, inert, in a DOM React keeps (agy, #17)
      this.navigating = false;
      this.state = null;
      this.exposedPath = null; // an exposure belongs to that visit only (agy, #20)
      this.disconnect();
      return 'not-listing';
    }
    const listing = query('listing', doc)?.element ?? null;
    const signature = signatureOf(listing, page.owner, page.repo);
    const path = listingPath(url.pathname);
    const navigated = this.state?.pathname !== path;

    // Soft navigation fires before React renders the new listing (ref-docs/research-update-
    // 2026-11-16-phase1-fixtures.md section 6). A resolved ref proves the DOM belongs to this URL
    // (it passed the cross-check); otherwise rows identical to the previous page's are stale.
    if (
      navigated &&
      this.state !== null &&
      page.ref === null &&
      signature !== null &&
      signature === this.state.signature &&
      listing === this.state.node
    ) {
      this.observe(this.observationRoot()); // the old observer root may be gone (agy, #16)
      return 'stale';
    }

    if (navigated || this.state === null) {
      // A different listing: reset to the default (docs/architecture.md section 3.2).
      this.state = {
        pathname: path,
        expanded: false,
        shownWithoutToggle: this.exposedPath === path,
        installed: false,
        signature,
        node: listing,
        rerenders: 0,
        exhausted: false,
      };
      this.exposedPath = null;
    }
    const state = this.state;
    state.signature = signature;
    state.node = listing;
    if (state.exhausted) return 'budget';

    if (!listing) {
      // Mid-navigation, the old listing is gone and the new one not yet rendered: keep the
      // navigation pre-hide (nothing visible is hidden; the navigation watchdog bounds it), or the
      // new listing renders visible for a frame (measured live on #16). Watch for it to arrive.
      // On a cold load there is no navigation in flight, and pending is cleared as before.
      if (!this.navigating) {
        // No click/popstate navigation is in flight (a keyboard-shortcut navigation, a cold load
        // whose listing has not rendered, or React unmounting the listing): the marker must not
        // outlive the toggle (agy, #16). A listing rendering from here on is visible: it is not
        // collapsed late, and one the user had already set keeps that choice (Codex, agy, #17).
        clearPending(doc);
        setCollapsed(doc, false);
        // On folder pages the commit bar is a separate box that may outlive the listing: no inert
        // toggle may stay behind in it (agy, #20). The next apply puts a working one back.
        this.removeToggles();
        state.shownWithoutToggle = state.installed ? state.expanded : true;
        state.installed = false;
      } else if (queryAll('gnrToggle', doc).elements.length === 0) {
        // Mid-navigation with the toggle gone too: nothing may treat it as still installed (agy,
        // post-merge review of #19). The pre-hide stays, bounded by the navigation watchdog.
        state.installed = false;
      }
      this.observe(this.observationRoot());
      return 'no-listing';
    }
    const header = findHeaderLine(doc);
    if (!header) {
      this.removeToggles(); // an orphaned, inert button must not stay behind (agy, #17)
      if (this.navigating) {
        // Mid-navigation the header line may simply not have rendered yet (or the outgoing page's
        // is being replaced). Keep the pre-hide rather than expose the files and record them as
        // shown, which kept a root expanded after /tree/<ref> -> /o/r (agy, #17). The navigation
        // watchdog bounds it, and shows the files if no header line ever arrives.
        state.installed = false;
        this.observe(this.observationRoot());
        return 'no-header';
      }
      // The confidence gate: leave GitHub's listing visible. If an earlier apply collapsed it and
      // the header (with our toggle) has since gone, show the files again (Codex, #16), and keep
      // them shown when the header returns: no late collapse.
      clearPending(doc);
      setCollapsed(doc, false);
      this.navigating = false;
      state.shownWithoutToggle = true;
      state.installed = false;
      // Watch for the header line arriving later: nothing else would re-apply (agy, #16). The
      // code-view app contains both the listing and the commit bar on either layout; the listing's
      // parent does not on folder pages, where the bar is a separate section (Codex, #16).
      this.observe(this.observationRoot());
      return 'no-header';
    }

    // First successful apply on this listing: no late collapse if rows were already exposed.
    if (!state.installed) state.expanded = state.shownWithoutToggle;

    if (!listing.id) {
      listing.id = LISTING_ID;
      this.assignedId = listing;
    }
    const button = this.ensureToggle(header.insertionPoint, listing.id);
    // Installed only once the toggle really is in the DOM: if insertion throws, the watchdog must
    // not believe a toggle exists (agy, #16).
    state.installed = true;
    // Order matters: the toggle is in the DOM before the hiding class is applied.
    setToggleExpanded(button, state.expanded);
    setCollapsed(doc, !state.expanded);
    // An apply on the OUTGOING page (a re-render before the URL changes) must not end a navigation
    // pre-hide meant for the destination: the empty moment and the new listing would then come
    // unhidden (measured live on #16). Any other listing is the destination, redirected or not.
    // The navigation watchdog still bounds it.
    if (!this.navigating || path !== this.navOrigin) {
      clearPending(doc);
      this.navigating = false;
    }

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

  /**
   * An in-page navigation toward `destination` is starting (a link click, or back/forward). If it
   * leads to a DIFFERENT listing, set the bounded pre-hide now, synchronously, so the new listing
   * renders hidden instead of flashing until the next frame's apply (maintainer live check on #16).
   * The apply that installs the toggle clears it, as does every apply exit without one; the
   * navigation watchdog bounds it if no apply succeeds within 4 seconds. Returns whether it was set.
   */
  navigationStarting(destination: URL): boolean {
    if (destination.origin !== 'https://github.com') return false;
    if (detectPage(destination).kind === 'other') return false;
    const target = listingPath(destination.pathname);
    if (target === this.state?.pathname) {
      this.returningTo(target);
      return false;
    }
    setPending(this.doc);
    this.exposedPath = null; // a fresh, pre-hidden visit: an earlier exposure no longer applies
    this.navigating = true;
    this.navOrigin = this.state?.pathname ?? null;
    const token = ++this.navigation;
    this.ctx.setTimeout(() => {
      if (token !== this.navigation) return; // a later navigation armed its own watchdog
      this.navigating = false;
      // Always end the pre-hide: an aborted navigation leaves the old URL, and a pending attribute
      // left behind would hide the listing whatever its toggle says.
      clearPending(this.doc);
      // Decided by outcome, not by the attribute (another timer may have cleared it): unless a
      // toggle is installed for the listing actually shown, show its files.
      const here = listingPath(this.doc.location.pathname);
      if (this.toggleLive(here)) return;
      setCollapsed(this.doc, false);
      this.markExposed();
      log.debug('navigation watchdog: no toggle within 4 s, showing GitHub’s listing');
    }, WATCHDOG_MS);
    return true;
  }

  /**
   * The cold-load watchdog's action. It ends only the cold-load pre-hide: once a navigation has set
   * its own (with its own watchdog), the cold-load timer must not clear it. A folder click about
   * 4 s after load otherwise lost its pre-hide mid-navigation (measured live on #16).
   */
  endInitialPreHide(): boolean {
    if (this.navigation > 0) return false;
    if (!isPending(this.doc)) return false;
    clearPending(this.doc);
    const here = listingPath(this.doc.location.pathname);
    if (!this.toggleLive(here)) this.markExposed();
    return true;
  }

  /**
   * A navigation signal (`type` is the event name), before the per-frame apply. A navigation that
   * completes back on the listing it started from (a link redirecting to the page already shown)
   * would otherwise keep its pre-hide until the watchdog: an apply there counts as a re-render of
   * the outgoing page. Only completion events count; the toggle must be installed there (agy, #17).
   */
  navigationSignal(type: string): void {
    if (!this.navigating || !COMPLETION_SIGNALS.has(type)) return;
    const here = listingPath(this.doc.location.pathname);
    if (here !== this.navOrigin) return;
    this.returningTo(here);
  }

  /** The user's click on `button`: flips the state of the listing currently shown. */
  toggle(button: HTMLButtonElement): void {
    const state = this.state;
    const listing = query('listing', this.doc)?.element;
    if (!state || !listing) return;
    state.expanded = !state.expanded;
    setToggleExpanded(button, state.expanded);
    setCollapsed(this.doc, !state.expanded);
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
