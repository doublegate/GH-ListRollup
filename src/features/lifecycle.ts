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
import { detectPage } from '@/github/page';
import { query } from '@/github/selectors';
import { log } from '@/log';
import {
  type ApplyOutcome,
  CollapseController,
  WATCHDOG_MS,
  clearPending,
  isPending,
  setPending,
} from './collapse';

export interface Lifecycle {
  controller: CollapseController;
  /** Applies now, for the current `location`. */
  apply(): ApplyOutcome;
}

export function startLifecycle(
  ctx: ContentScriptContext,
  doc: Document = document,
  onApply: (outcome: ApplyOutcome) => void = () => undefined,
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
      if (isPending(doc)) {
        clearPending(doc);
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

  // 3. Soft navigation (already coalesced to one call per animation frame).
  watchNavigation(ctx, () => {
    apply();
  });

  return { controller, apply };
}
