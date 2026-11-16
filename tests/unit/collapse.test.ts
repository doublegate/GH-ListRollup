/**
 * Level 1 collapse: T-GNR-105 (toggle and controller), T-GNR-106 (lifecycle), T-GNR-108 (state
 * reset), against the HTML fixtures. Specs: docs/ui-behavior.md section 2, docs/dom-integration.md
 * section 4.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  COLLAPSED_CLASS,
  CollapseController,
  RERENDER_BUDGET,
  WATCHDOG_MS,
  isPending,
  setPending,
} from '@/features/collapse';
import { startLifecycle } from '@/features/lifecycle';
import { findHeaderLine } from '@/github/header';
import { query } from '@/github/selectors';
import { LABEL_HIDE, LABEL_SHOW } from '@/ui/toggle';
import { fixtureUrl, loadHtmlFixture, resetDocument } from '../helpers/fixture';

let ctx: ContentScriptContext;

beforeEach(() => {
  ctx = new ContentScriptContext('test');
});

afterEach(() => {
  ctx.notifyInvalidated();
  vi.useRealTimers();
  resetDocument();
});

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const toggles = (doc: Document) => doc.querySelectorAll('[data-gnr="toggle"]');
const toggle = (doc: Document) => {
  const t = doc.querySelector('[data-gnr="toggle"]');
  if (!(t instanceof HTMLButtonElement)) throw new Error('no toggle');
  return t;
};
const listing = (doc: Document) => {
  const l = query('listing', doc)?.element;
  if (!l) throw new Error('no listing');
  return l;
};
const collapsed = (doc: Document) => listing(doc).classList.contains(COLLAPSED_CLASS);

/** Loads a fixture and applies a fresh controller to it. */
const applied = (name: string, url?: string) => {
  const doc = loadHtmlFixture(name, url === undefined ? {} : { url });
  const controller = new CollapseController(ctx, doc);
  const outcome = controller.apply(new URL(url ?? fixtureUrl(name)));
  return { doc, controller, outcome };
};

const LISTINGS = ['root', 'folder', 'root-logged-in', 'folder-logged-in', 'folder-deep'] as const;

describe('toggle and controller (T-GNR-105)', () => {
  it.each(LISTINGS)('%s: one toggle, collapsed by default, in the header line', (name) => {
    const { doc, outcome } = applied(name);
    expect(outcome).toBe('applied');
    expect(toggles(doc).length).toBe(1);
    expect(collapsed(doc)).toBe(true);
    const button = toggle(doc);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe(LABEL_SHOW);
    expect(button.getAttribute('aria-controls')).toBe(listing(doc).id);
    expect(findHeaderLine(doc)?.insertionPoint.firstElementChild).toBe(button);
  });

  it('a click expands, a second click collapses, and aria-expanded follows', () => {
    const { doc } = applied('root');
    const button = toggle(doc);
    button.click();
    expect(collapsed(doc)).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe(LABEL_HIDE);
    button.click();
    expect(collapsed(doc)).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('is a native button, so Enter and Space activate it through its click', () => {
    const { doc } = applied('root');
    const button = toggle(doc);
    expect(button.tagName).toBe('BUTTON');
    expect(button.type).toBe('button');
  });

  it('inserts the toggle before it applies the hiding class (MutationObserver order)', async () => {
    const doc = loadHtmlFixture('folder');
    const records: string[] = [];
    const watch = new MutationObserver((list) => {
      for (const r of list) {
        if (
          r.type === 'childList' &&
          [...r.addedNodes].some(
            (n) => n instanceof Element && n.getAttribute('data-gnr') === 'toggle',
          )
        ) {
          records.push('toggle');
        }
        if (
          r.type === 'attributes' &&
          r.attributeName === 'class' &&
          (r.target as Element).classList.contains(COLLAPSED_CLASS)
        ) {
          records.push('class');
        }
      }
    });
    watch.observe(doc.documentElement, { childList: true, subtree: true, attributes: true });
    new CollapseController(ctx, doc).apply(new URL(fixtureUrl('folder')));
    await Promise.resolve();
    watch.disconnect();
    expect(records).toEqual(['toggle', 'class']);
  });

  it('does not intercept clicks on GitHub controls in the header area', () => {
    const { doc } = applied('root');
    const line = findHeaderLine(doc)?.insertionPoint;
    const others = [...(line?.parentElement?.getElementsByTagName('a') ?? [])];
    expect(others.length).toBeGreaterThan(0);
    for (const a of others) {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      a.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    // Branch picker and "Go to file" are buttons elsewhere on the page.
    for (const b of doc.getElementsByTagName('button')) {
      if (b.getAttribute('data-gnr') === 'toggle') continue;
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      b.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(collapsed(doc)).toBe(true);
  });

  it('is idempotent: apply() 10 times produces one toggle', () => {
    const { doc, controller } = applied('root');
    for (let i = 0; i < 10; i++) controller.apply(new URL(fixtureUrl('root')));
    expect(toggles(doc).length).toBe(1);
    expect(collapsed(doc)).toBe(true);
  });
});

describe('lifecycle (T-GNR-106)', () => {
  it('the watchdog removes the pending attribute when no listing appears', () => {
    vi.useFakeTimers();
    const doc = loadHtmlFixture('root');
    listing(doc).remove();
    startLifecycle(ctx, doc);
    expect(isPending(doc)).toBe(true);
    vi.advanceTimersByTime(WATCHDOG_MS - 1);
    expect(isPending(doc)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isPending(doc)).toBe(false);
  });

  it('a non-listing URL never sets the pending attribute', () => {
    const doc = loadHtmlFixture('root', { url: 'https://github.com/git/git/issues' });
    startLifecycle(ctx, doc);
    expect(isPending(doc)).toBe(false);
  });

  it('when the header line is missing, apply() clears pending at once and the rows stay visible', () => {
    const doc = loadHtmlFixture('root');
    setPending(doc);
    findHeaderLine(doc)?.insertionPoint.remove();
    const outcome = new CollapseController(ctx, doc).apply(new URL(fixtureUrl('root')));
    expect(outcome).toBe('no-header');
    expect(isPending(doc)).toBe(false);
    expect(collapsed(doc)).toBe(false);
    expect(toggles(doc).length).toBe(0);
  });

  it('apply() on a non-listing page, also after a soft navigation, clears pending at once', () => {
    const { doc, controller } = applied('root');
    setPending(doc); // as if left over
    loadHtmlFixture('root', { url: 'https://github.com/git/git/issues' });
    expect(controller.apply(new URL('https://github.com/git/git/issues'))).toBe('not-listing');
    expect(isPending(document)).toBe(false);
  });

  it('a successful first apply clears pending, after the toggle exists', () => {
    const doc = loadHtmlFixture('folder');
    setPending(doc);
    new CollapseController(ctx, doc).apply(new URL(fixtureUrl('folder')));
    expect(isPending(doc)).toBe(false);
    expect(toggles(doc).length).toBe(1);
  });

  it('an exception inside apply() clears pending and leaves the page alone', () => {
    const doc = loadHtmlFixture('root');
    setPending(doc);
    const controller = new CollapseController(ctx, doc);
    const spy = vi.spyOn(listing(doc).classList, 'toggle').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(controller.apply(new URL(fixtureUrl('root')))).toBe('error');
    spy.mockRestore();
    expect(isPending(doc)).toBe(false);
  });

  it('replacing tbody keeps one toggle and the collapsed state', async () => {
    const { doc, controller } = applied('root');
    const lifecycleApply = () => controller.apply(new URL(fixtureUrl('root')));
    const tbody = listing(doc).getElementsByTagName('tbody')[0];
    tbody?.replaceWith(tbody.cloneNode(true));
    lifecycleApply();
    await nextFrame();
    expect(toggles(doc).length).toBe(1);
    expect(collapsed(doc)).toBe(true);
  });

  it('a React re-render of the header line gets the toggle back within one frame', async () => {
    const doc = loadHtmlFixture('root');
    const { controller } = startLifecycle(ctx, doc);
    await nextFrame();
    expect(toggles(doc).length).toBe(1);
    // React replaces the commit bar's inner row with a fresh copy that has no toggle.
    const row = findHeaderLine(doc)?.insertionPoint;
    const fresh = row?.cloneNode(true) as Element;
    fresh.querySelector('[data-gnr="toggle"]')?.remove();
    row?.replaceWith(fresh);
    expect(toggles(doc).length).toBe(0);
    await nextFrame(); // observer callback schedules
    await nextFrame(); // the scheduled apply runs
    expect(toggles(doc).length).toBe(1);
    expect(controller.current?.expanded).toBe(false);
    expect(collapsed(doc)).toBe(true);
  });

  it('the re-render observer stops after its budget', async () => {
    const doc = loadHtmlFixture('root');
    const apply = vi.fn();
    const controller = new CollapseController(ctx, doc, apply);
    controller.apply(new URL(fixtureUrl('root')));
    const tbody = listing(doc).getElementsByTagName('tbody')[0];
    for (let i = 0; i < RERENDER_BUDGET + 10; i++) {
      tbody?.appendChild(doc.createElement('tr'));
      await Promise.resolve();
      await nextFrame();
    }
    expect(apply.mock.calls.length).toBeLessThanOrEqual(RERENDER_BUDGET);
    expect(controller.current?.rerenders).toBe(RERENDER_BUDGET + 1);
  });

  it('after a soft navigation, waits until the DOM shows the new listing', () => {
    const { doc, controller } = applied('root');
    toggle(doc).click(); // expanded on the root
    // URL changes to a folder, but the DOM still shows the root's rows (observed live).
    const folderUrl = 'https://github.com/git/git/tree/master/contrib';
    loadHtmlFixture('root', { url: folderUrl });
    expect(controller.apply(new URL(folderUrl))).toBe('stale');
    // React renders the folder listing: now it applies, collapsed (a different listing).
    const folderDoc = loadHtmlFixture('folder');
    expect(controller.apply(new URL(folderUrl))).toBe('applied');
    expect(collapsed(folderDoc)).toBe(true);
  });

  it('a stripped-hook page either works through the fallbacks or is left untouched', () => {
    const doc = loadHtmlFixture('root');
    setPending(doc);
    for (const el of doc.querySelectorAll('[data-testid]')) el.removeAttribute('data-testid');
    query('codeView', doc)?.element.removeAttribute('app-name');
    const outcome = new CollapseController(ctx, doc).apply(new URL(fixtureUrl('root')));
    expect(isPending(doc)).toBe(false);
    if (outcome === 'applied') {
      expect(toggles(doc).length).toBe(1);
    } else {
      // Never hidden without a toggle.
      expect(toggles(doc).length).toBe(0);
      const l = doc.querySelector('table[aria-labelledby="folders-and-files"]');
      expect(l?.closest(`.${COLLAPSED_CLASS}`)).toBeNull();
    }
  });
});

describe('state reset on navigation (T-GNR-108)', () => {
  it('a re-render of the same listing keeps it expanded', () => {
    const { doc, controller } = applied('root');
    toggle(doc).click();
    controller.apply(new URL(fixtureUrl('root')));
    expect(collapsed(doc)).toBe(false);
    expect(toggle(doc).getAttribute('aria-expanded')).toBe('true');
  });

  it('expand, navigate to another repository: the new page is collapsed', () => {
    const { doc, controller } = applied('root');
    toggle(doc).click();
    const other = loadHtmlFixture('root-slash-ref');
    expect(controller.apply(new URL(fixtureUrl('root-slash-ref')))).toBe('applied');
    expect(collapsed(other)).toBe(true);
  });

  it('expand on the root, soft-navigate to a folder of the same repo and ref: collapsed', () => {
    const { doc, controller } = applied('root');
    toggle(doc).click();
    const folder = loadHtmlFixture('folder');
    expect(controller.apply(new URL(fixtureUrl('folder')))).toBe('applied');
    expect(collapsed(folder)).toBe(true);
    expect(toggle(folder).getAttribute('aria-expanded')).toBe('false');
  });

  it('no late collapse: a listing first shown without a toggle stays expanded', () => {
    const doc = loadHtmlFixture('root');
    const row = findHeaderLine(doc)?.insertionPoint;
    const parent = row?.parentElement;
    row?.remove();
    const controller = new CollapseController(ctx, doc);
    expect(controller.apply(new URL(fixtureUrl('root')))).toBe('no-header');
    // The header line renders later: the toggle is added, but the listing stays expanded.
    if (row && parent) parent.prepend(row);
    expect(controller.apply(new URL(fixtureUrl('root')))).toBe('applied');
    expect(collapsed(doc)).toBe(false);
    expect(toggle(doc).getAttribute('aria-expanded')).toBe('true');
  });
});
