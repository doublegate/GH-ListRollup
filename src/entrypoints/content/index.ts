/**
 * Content script entry (docs/architecture.md section 2).
 *
 * Phase 0 skeleton: logs the detected page type on load and after every soft navigation. The
 * collapse and tree features arrive in Phases 1 and 2.
 */
import { defineContentScript } from 'wxt/utils/define-content-script';
import { detectPage } from '@/github/page';
import { watchNavigation } from '@/github/nav';
import { log } from '@/log';

export default defineContentScript({
  // All of github.com: GitHub navigates in-app, so a narrower match would miss soft navigations
  // into a repository page (docs/cross-browser.md section 2).
  matches: ['https://github.com/*'],
  runAt: 'document_start',
  main(ctx) {
    let lastHref = '';
    const report = (): void => {
      if (location.href === lastHref) return;
      lastHref = location.href;
      const page = detectPage(new URL(location.href));
      const repo = page.owner && page.repo ? [`${page.owner}/${page.repo}`] : [];
      // The path makes it visible which URL the detector saw (T-GNR-004 Firefox diagnosis).
      log.info('page', page.kind, ...repo, `path=${location.pathname}${location.search}`);
    };

    report();
    watchNavigation(ctx, report);
    ctx.onInvalidated(() => log.debug('content script invalidated'));
  },
});
