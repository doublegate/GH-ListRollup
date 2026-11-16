/**
 * Navigation watcher (docs/dom-integration.md section 4).
 *
 * GitHub changes pages without full loads (Turbo plus a React router, wrapped in `soft-nav:*`
 * events). This turns all of those signals into one callback per animation frame. Only event names
 * are used; payloads from the page world are not read.
 */
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

/** Document-level events GitHub fires after a soft navigation has rendered. */
export const SOFT_NAV_EVENTS = [
  'soft-nav:end',
  'soft-nav:react-done',
  'turbo:render',
  'turbo:load',
] as const;

/** The Navigation API, where the browser exposes it to the content script. */
interface NavigationLike extends EventTarget {
  readonly currentEntry?: unknown;
}

export function watchNavigation(
  ctx: ContentScriptContext,
  onChange: () => void,
  /** Called with each signal's event type, before coalescing (diagnostics: T-GNR-106). */
  onSignal: (type: string) => void = () => undefined,
): void {
  let scheduled = false;
  const schedule = (event: Event): void => {
    onSignal(event.type);
    if (scheduled) return;
    scheduled = true;
    ctx.requestAnimationFrame(() => {
      scheduled = false;
      onChange();
    });
  };

  for (const type of SOFT_NAV_EVENTS) {
    ctx.addEventListener(document, type, schedule);
  }
  ctx.addEventListener(window, 'popstate', schedule);
  // WXT's own URL watcher: fires at the start of a navigation, so it is a supplement only.
  ctx.addEventListener(window, 'wxt:locationchange', schedule);
  // The Navigation API's completion event (docs/dom-integration.md section 4, step 4). Whether it
  // reaches Firefox content scripts is the T-GNR-106 question; popstate above is the fallback.
  const navigation = (window as unknown as { navigation?: NavigationLike }).navigation;
  if (navigation && typeof navigation.addEventListener === 'function') {
    navigation.addEventListener('navigatesuccess', schedule, { signal: ctx.signal });
  }
}
