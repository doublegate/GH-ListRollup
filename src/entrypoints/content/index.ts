/**
 * Content script entry (docs/architecture.md section 2).
 *
 * Phase 1 Sprint 1: logs the detected page type on load and after every soft navigation, and, on
 * listing pages, the page model and the selector probe (debug level). Nothing on the page changes
 * yet; the collapse arrives in Phase 1 Sprint 2.
 */
import { defineContentScript } from 'wxt/utils/define-content-script';
import { detectPage, pageKey, readListingPage } from '@/github/page';
import { watchNavigation } from '@/github/nav';
import { formatProbe, probe } from '@/github/probe';
import { log } from '@/log';

export default defineContentScript({
  // All of github.com: GitHub navigates in-app, so a narrower match would miss soft navigations
  // into a repository page (docs/cross-browser.md section 2).
  matches: ['https://github.com/*'],
  runAt: 'document_start',
  main(ctx) {
    let lastKey = '';
    const report = (): void => {
      const key = pageKey(new URL(location.href));
      if (key === lastKey) return;
      lastKey = key;
      const page = detectPage(new URL(location.href));
      const repo = page.owner && page.repo ? [`${page.owner}/${page.repo}`] : [];
      // The path makes it visible which URL the detector saw (T-GNR-004 Firefox diagnosis).
      log.info('page', page.kind, ...repo, `path=${location.pathname}${location.search}`);
      if (page.kind !== 'other') whenParsed(inspectListing);
    };

    // At document_start the listing is not parsed yet: wait for DOMContentLoaded once. Soft
    // navigations fire after GitHub has rendered, so they inspect at once.
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
      log.debug(
        'listing',
        `layout=${listing.layout}`,
        `ref=${listing.ref}`,
        `path=${listing.path}`,
      );
      log.debug('probe:', formatProbe(probe(document)));
    };

    report();
    watchNavigation(ctx, report);
    ctx.onInvalidated(() => log.debug('content script invalidated'));
  },
});
