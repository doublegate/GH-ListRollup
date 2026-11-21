/**
 * Content script entry (docs/architecture.md section 2).
 *
 * Level 1, the whole-listing collapse (Phase 1): `startLifecycle` sets the pre-hide, inserts the
 * toggle and keeps it across soft navigations and re-renders. This module also logs the detected
 * page type (info) and, on listing pages, the page model, the probe and the navigation signals seen
 * (debug level).
 */
import './style.css';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { detectPage, pageKey, readListingPage } from '@/github/page';
import { formatProbe, probe } from '@/github/probe';
import { startLifecycle } from '@/features/lifecycle';
import { log } from '@/log';

export default defineContentScript({
  // All of github.com: GitHub navigates in-app, so a narrower match would miss soft navigations
  // into a repository page (docs/cross-browser.md section 2).
  matches: ['https://github.com/*'],
  runAt: 'document_start',
  main(ctx) {
    // The page line is de-duplicated by URL; the DOM inspection is NOT. The first navigation signal
    // (`wxt:locationchange`, `popstate`) arrives before React renders the new listing, so the page is
    // inspected again on every later signal for the same URL, and logged only when the reading
    // changes (Codex review, #14; ref-docs/research-update-2026-11-16-phase1-fixtures.md section 6).
    let lastKey = '';
    let lastReading = '';
    const report = (): void => {
      const url = new URL(location.href);
      const page = detectPage(url);
      const key = pageKey(url);
      if (key !== lastKey) {
        lastKey = key;
        lastReading = ''; // every page logs its own reading, even if it matches the last page's
        const repo = page.owner && page.repo ? [`${page.owner}/${page.repo}`] : [];
        // The path makes it visible which URL the detector saw (T-GNR-004 Firefox diagnosis).
        log.info('page', page.kind, ...repo, `path=${location.pathname}${location.search}`);
      }
      if (page.kind !== 'other') whenParsed(inspectListing);
    };

    // At document_start the listing is not parsed yet: wait for DOMContentLoaded once. Soft
    // navigations fire after GitHub has started rendering, so they inspect at once.
    const whenParsed = (fn: () => void): void => {
      if (document.readyState === 'loading') {
        ctx.addEventListener(document, 'DOMContentLoaded', fn, { once: true });
      } else {
        fn();
      }
    };
    // Debug level only: Phase 3 gates it behind the debug.logging setting (T-GNR-301).
    const inspectListing = (): void => {
      const listing = readListingPage(new URL(location.href), document);
      // Only on code-view listing pages: a two-segment URL such as /<user>/<tab> passes the URL
      // check but is not one (agy review, #14).
      if (!listing) return;
      const reading = [
        `layout=${listing.layout}`,
        `ref=${listing.ref}`,
        `path=${listing.path}`,
        `| probe: ${formatProbe(probe(document))}`,
      ].join(' ');
      if (reading === lastReading) return;
      lastReading = reading;
      log.debug('listing', reading);
    };

    // Which navigation signals reach this content script, once per type per load (T-GNR-106: does
    // the Navigation API's navigatesuccess arrive in Firefox?). The lifecycle's navigation watcher
    // is shared, not duplicated (agy, #17).
    const seen = new Set<string>();
    startLifecycle(
      ctx,
      document,
      (outcome) => {
        if (outcome !== 'applied') log.debug('apply:', outcome);
      },
      {
        onNavigation: report,
        onSignal: (type) => {
          if (seen.has(type)) return;
          seen.add(type);
          log.debug('nav signal:', type);
        },
      },
    );
    report();
    ctx.onInvalidated(() => log.debug('content script invalidated'));
  },
});
