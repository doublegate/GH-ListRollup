/**
 * Content-script lifecycle for Level 1 (T-GNR-106, docs/dom-integration.md section 4).
 *
 * 1. `document_start`, on a listing-shaped URL only: set `html[data-gnr-pending]` (CSS hides the
 *    rows) and start the 4-second watchdog that always removes it.
 * 2. First apply: when the listing appears (a document observer, disconnected after the first match)
 *    and once at DOMContentLoaded.
 * 3. Soft navigation: every signal from `watchNavigation` re-applies, one per animation frame.
 * 4. React re-renders: the controller's own scoped observer.
 * Everything is registered through `ctx`, so an extension update or reload tears it down.
 */
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { watchNavigation } from '@/github/nav';
import { detectPage, listingPath } from '@/github/page';
import { closest, query } from '@/github/selectors';
import { log } from '@/log';
import { type ApplyOutcome, CollapseController, WATCHDOG_MS, setPending } from './collapse';

export interface Lifecycle {
  controller: CollapseController;
  /** Applies now, for the current `location`. */
  apply(): ApplyOutcome;
}

/** Optional observers of the lifecycle's single navigation watcher (the content script's logging). */
export interface LifecycleHooks {
  /** After each coalesced navigation change, before the apply. */
  onNavigation?: () => void;
  /** Each navigation signal's event type, before coalescing. */
  onSignal?: (type: string) => void;
}

export function startLifecycle(
  ctx: ContentScriptContext,
  doc: Document = document,
  onApply: (outcome: ApplyOutcome) => void = () => undefined,
  hooks: LifecycleHooks = {},
): Lifecycle {
  const apply = (): ApplyOutcome => {
    const outcome = controller.apply(new URL(doc.location.href));
    onApply(outcome);
    return outcome;
  };
  const controller = new CollapseController(ctx, doc, apply);

  // 1. Pre-hide and watchdog: listing-shaped URLs only. Soft navigation never sets it.
  const listingShaped = detectPage(new URL(doc.location.href)).kind !== 'other';
  if (listingShaped) {
    setPending(doc);
    ctx.setTimeout(() => {
      if (controller.endInitialPreHide()) {
        log.debug('watchdog: no toggle within 4 s, showing GitHub’s listing');
      }
    }, WATCHDOG_MS);
  }

  // 2. First apply: as soon as the listing exists, and in any case at DOMContentLoaded. The document
  // observer runs only on listing-shaped URLs and for at most the watchdog's 4 seconds; soft
  // navigations reach listings through their own signals (agy, #16).
  if (query('listing', doc)) {
    controller.schedule();
  } else if (listingShaped) {
    const first = new MutationObserver(() => {
      if (!query('listing', doc)) return;
      first.disconnect();
      controller.schedule();
    });
    first.observe(doc.documentElement, { childList: true, subtree: true });
    ctx.setTimeout(() => {
      first.disconnect();
    }, WATCHDOG_MS);
    ctx.onInvalidated(() => {
      first.disconnect();
    });
  }
  if (doc.readyState === 'loading') {
    ctx.addEventListener(doc, 'DOMContentLoaded', () => apply(), { once: true });
  }

  // 2b. In-page navigation pre-hide, set synchronously at the start of the navigation (maintainer
  // live check on #16: back/forward and folder clicks showed the new listing for a frame or two).
  // A capture listener runs before GitHub's router handles the click; popstate fires with the
  // destination URL already in location, before the router renders it.
  ctx.addEventListener(
    doc,
    'click',
    (event) => {
      if (!(event instanceof MouseEvent) || event.button !== 0 || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? closest('anchor', event.target) : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const target = link.getAttribute('target');
      if (target && target !== '_self') return;
      if (link.hasAttribute('download')) return;
      // A user-authored href that does not parse (`http://[::1`) is no navigation we can read; this
      // listener runs for every link click on github.com, so it must not throw (agy, #17).
      let destination: URL;
      try {
        destination = new URL(link.href, doc.location.href);
      } catch {
        return;
      }
      // A link to the page already shown (an in-page anchor, a reload of the same listing) is no
      // navigation to a different listing (agy, #16). Not checked for popstate, where location is
      // already the destination.
      // A click back to the listing still shown, while a navigation is in flight, ends its
      // pre-hide if that listing's toggle still works (agy, post-merge review of #19).
      if (listingPath(destination.pathname) === listingPath(doc.location.pathname)) {
        controller.returningTo(listingPath(destination.pathname));
        return;
      }
      controller.navigationStarting(destination);
    },
    { capture: true },
  );
  ctx.addEventListener(window, 'popstate', () => {
    controller.navigationStarting(new URL(doc.location.href));
  });

  // 3. Soft navigation (already coalesced to one call per animation frame). The only navigation
  // watcher: the content script's logging hooks in here rather than registering its own (agy, #17).
  watchNavigation(
    ctx,
    () => {
      hooks.onNavigation?.();
      apply();
    },
    (type) => {
      controller.navigationSignal(type);
      hooks.onSignal?.(type);
    },
  );

  return { controller, apply };
}
