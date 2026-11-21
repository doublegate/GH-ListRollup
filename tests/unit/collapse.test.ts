/**
 * Level 1 collapse: T-GNR-105 (toggle and controller), T-GNR-106 (lifecycle), T-GNR-108 (state
 * reset), against the HTML fixtures. Specs: docs/ui-behavior.md section 2, docs/dom-integration.md
 * section 4.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  COLLAPSED_ATTR,
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
// The collapsed marker lives on <html>: React owns the listing container's class (see #16).
const collapsed = (doc: Document) => doc.documentElement.hasAttribute(COLLAPSED_ATTR);

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
          r.attributeName === COLLAPSED_ATTR &&
          (r.target as Element).hasAttribute(COLLAPSED_ATTR)
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
    const { controller } = applied('root');
    const issues = loadHtmlFixture('root', { url: 'https://github.com/git/git/issues' });
    setPending(issues); // set AFTER the load, which replaces the document element (agy, #16)
    expect(controller.apply(new URL('https://github.com/git/git/issues'))).toBe('not-listing');
    expect(isPending(issues)).toBe(false);
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
    const spy = vi.spyOn(doc.documentElement, 'setAttribute').mockImplementation(() => {
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
      expect(collapsed(doc)).toBe(false);
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

describe('review findings on #16', () => {
  it('listing -> non-listing -> back to the same listing starts collapsed again (agy)', () => {
    const { doc, controller } = applied('root');
    toggle(doc).click(); // expanded
    loadHtmlFixture('root', { url: 'https://github.com/git/git/issues' });
    expect(controller.apply(new URL('https://github.com/git/git/issues'))).toBe('not-listing');
    const back = loadHtmlFixture('root');
    expect(controller.apply(new URL(fixtureUrl('root')))).toBe('applied');
    expect(collapsed(back)).toBe(true);
    expect(toggle(back).getAttribute('aria-expanded')).toBe('false');
  });

  it('/o/r/tree/<tag> -> /o/r: an apply on the stale DOM still ends collapsed on the new listing (agy)', () => {
    const tagUrl = fixtureUrl('root-tag');
    const { doc, controller } = applied('root-tag');
    toggle(doc).click(); // expanded on the tag
    // URL changes to the repository root while the tag's rows are still shown; the tag's ref
    // passes the root cross-check, so the controller applies on the stale DOM.
    loadHtmlFixture('root-tag', { url: 'https://github.com/git/git' });
    controller.apply(new URL('https://github.com/git/git'));
    // React renders the root listing.
    const root = loadHtmlFixture('root');
    expect(controller.apply(new URL(fixtureUrl('root')))).toBe('applied');
    expect(collapsed(root)).toBe(true);
    expect(toggles(root).length).toBe(1);
    expect(tagUrl).not.toBe(fixtureUrl('root'));
  });

  it('if the header line disappears after a collapse, the files are shown again (Codex)', () => {
    const { doc, controller } = applied('root');
    expect(collapsed(doc)).toBe(true);
    const row = findHeaderLine(doc)?.insertionPoint;
    const parent = row?.parentElement;
    row?.remove(); // React drops the commit bar, and our toggle with it
    expect(controller.apply(new URL(fixtureUrl('root')))).toBe('no-header');
    expect(collapsed(doc)).toBe(false);
    // When the header returns, the listing stays expanded: no late collapse.
    if (row && parent) {
      row.querySelector('[data-gnr="toggle"]')?.remove();
      parent.prepend(row);
    }
    expect(controller.apply(new URL(fixtureUrl('root')))).toBe('applied');
    expect(collapsed(doc)).toBe(false);
    expect(toggle(doc).getAttribute('aria-expanded')).toBe('true');
  });

  it('invalidation shows the files again and removes the inert toggle (Codex)', () => {
    const doc = loadHtmlFixture('root');
    startLifecycle(ctx, doc).apply();
    expect(collapsed(doc)).toBe(true);
    ctx.notifyInvalidated();
    expect(collapsed(doc)).toBe(false);
    expect(toggles(doc).length).toBe(0);
    expect(isPending(doc)).toBe(false);
  });

  it('a header line rendered after a no-header exit is picked up without a navigation (agy)', async () => {
    const doc = loadHtmlFixture('root');
    const row = findHeaderLine(doc)?.insertionPoint;
    const parent = row?.parentElement;
    row?.remove();
    const outcomes: string[] = [];
    startLifecycle(ctx, doc, (o) => outcomes.push(o));
    await nextFrame(); // the lifecycle's first scheduled apply runs: no header yet
    await nextFrame();
    expect(outcomes).toContain('no-header');
    expect(toggles(doc).length).toBe(0);
    if (row && parent) parent.prepend(row); // the commit bar renders late
    await Promise.resolve();
    await nextFrame();
    await nextFrame();
    expect(toggles(doc).length).toBe(1);
  });

  it("the toggle insertion does not trigger the controller's own observer (agy)", async () => {
    const doc = loadHtmlFixture('root');
    const onSchedule = vi.fn();
    const controller = new CollapseController(ctx, doc, onSchedule);
    controller.apply(new URL(fixtureUrl('root')));
    // Remove our toggle (as a stray re-render might) and re-apply: the re-insertion is ours.
    toggle(doc).remove();
    controller.apply(new URL(fixtureUrl('root')));
    await Promise.resolve();
    await nextFrame();
    expect(onSchedule).not.toHaveBeenCalled();
  });

  it('a non-listing page gets no document observer (agy)', () => {
    const doc = loadHtmlFixture('root', { url: 'https://github.com/git/git/issues' });
    listing(doc).remove();
    const spy = vi.spyOn(MutationObserver.prototype, 'observe');
    startLifecycle(ctx, doc);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('folder layout: a commit bar rendered after a no-header exit is picked up too (Codex)', async () => {
    // On folder pages the commit bar is a separate box, outside the listing's parent.
    const doc = loadHtmlFixture('folder');
    const row = findHeaderLine(doc)?.insertionPoint;
    const parent = row?.parentElement;
    expect(parent?.contains(listing(doc))).toBe(false);
    row?.remove();
    const outcomes: string[] = [];
    startLifecycle(ctx, doc, (o) => outcomes.push(o));
    await nextFrame();
    await nextFrame();
    expect(outcomes).toContain('no-header');
    if (row && parent) parent.prepend(row);
    await Promise.resolve();
    await nextFrame();
    await nextFrame();
    expect(toggles(doc).length).toBe(1);
  });

  it('when the re-render budget runs out, the page is restored and left alone (Codex)', async () => {
    const doc = loadHtmlFixture('root');
    const controller = new CollapseController(ctx, doc, () => {
      controller.apply(new URL(fixtureUrl('root')));
    });
    controller.apply(new URL(fixtureUrl('root')));
    expect(collapsed(doc)).toBe(true);
    const tbody = listing(doc).getElementsByTagName('tbody')[0];
    for (let i = 0; i < RERENDER_BUDGET + 5; i++) {
      tbody?.appendChild(doc.createElement('tr'));
      await Promise.resolve();
      await nextFrame();
    }
    // Observation stopped: files shown and no control left that could vanish unobserved.
    expect(collapsed(doc)).toBe(false);
    expect(toggles(doc).length).toBe(0);
    // A later apply on the same listing (a navigation signal) leaves the page alone.
    expect(controller.apply(new URL(fixtureUrl('root')))).toBe('budget');
    expect(collapsed(doc)).toBe(false);
    expect(toggles(doc).length).toBe(0);
  });
});

describe('no flash (maintainer live check on #16)', () => {
  it('the collapse survives React replacing the listing container (cold-load flash)', () => {
    // Observed live: React re-inserts the container ~400 ms after the first apply, with class="".
    const { doc } = applied('root');
    const old = listing(doc);
    const fresh = old.cloneNode(true) as Element;
    fresh.removeAttribute('class');
    old.replaceWith(fresh);
    // Nothing has re-applied yet, but the marker on <html> still hides the new container.
    expect(collapsed(doc)).toBe(true);
  });

  it('the stylesheet hides the listing under the <html> marker', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/entrypoints/content/style.css', 'utf8');
    expect(css).toMatch(/html\[data-gnr-collapsed\] \[data-testid='directory-content'\]/);
  });

  describe('in-page navigation pre-hide', () => {
    const start = (name = 'root') => {
      const doc = loadHtmlFixture(name);
      const life = startLifecycle(ctx, doc);
      life.apply();
      expect(isPending(doc)).toBe(false);
      return { doc, life };
    };
    const clickLink = (
      doc: Document,
      href: string,
      init: MouseEventInit = {},
      attrs: Record<string, string> = {},
    ) => {
      const a = doc.createElement('a');
      a.setAttribute('href', href);
      for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
      doc.body.appendChild(a);
      a.addEventListener('click', (e) => e.preventDefault()); // no real navigation in the test
      a.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }),
      );
    };

    it('a click on a link to another listing sets pending synchronously', () => {
      const { doc } = start();
      clickLink(doc, '/git/git/tree/master/contrib');
      expect(isPending(doc)).toBe(true);
    });

    it('ignores modified, new-tab, off-site, non-listing and same-listing clicks', () => {
      const { doc } = start();
      clickLink(doc, '/git/git/tree/master/contrib', { ctrlKey: true });
      clickLink(doc, '/git/git/tree/master/contrib', { button: 1 });
      clickLink(doc, '/git/git/tree/master/contrib', {}, { target: '_blank' });
      clickLink(doc, 'https://example.com/git/git/tree/master/contrib');
      clickLink(doc, '/git/git/issues');
      clickLink(doc, '/git/git/blob/master/README.md');
      clickLink(doc, '/git/git'); // the listing already shown
      expect(isPending(doc)).toBe(false);
    });

    it('popstate to a different listing sets pending; to a non-listing it does not', () => {
      const { doc } = start();
      loadHtmlFixture('root', { url: 'https://github.com/git/git/issues' });
      window.dispatchEvent(new PopStateEvent('popstate'));
      expect(isPending(document)).toBe(false);
      loadHtmlFixture('folder');
      window.dispatchEvent(new PopStateEvent('popstate'));
      expect(isPending(document)).toBe(true);
      expect(doc).toBeDefined();
    });

    it('navigation watchdog, landed but never applied: shows the files after 4 s', () => {
      vi.useFakeTimers();
      const { doc } = start();
      clickLink(doc, '/git/git/tree/master/contrib');
      expect(isPending(doc)).toBe(true);
      // The URL changes but the DOM never shows the new listing (every apply is stale).
      const stale = loadHtmlFixture('root', {
        url: 'https://github.com/git/git/tree/master/contrib',
      });
      setPending(stale);
      stale.documentElement.setAttribute(COLLAPSED_ATTR, '');
      vi.advanceTimersByTime(WATCHDOG_MS);
      expect(isPending(stale)).toBe(false);
      expect(collapsed(stale)).toBe(false);
      expect(doc).toBeDefined();
    });

    it('navigation watchdog, aborted navigation: ends the pre-hide, keeps the working toggle', () => {
      vi.useFakeTimers();
      const { doc } = start();
      clickLink(doc, '/git/git/tree/master/contrib'); // the navigation never happens
      expect(isPending(doc)).toBe(true);
      vi.advanceTimersByTime(WATCHDOG_MS);
      expect(isPending(doc)).toBe(false); // otherwise the listing would stay hidden for good
      expect(collapsed(doc)).toBe(true); // still the collapsed state its toggle shows
      expect(toggles(doc).length).toBe(1);
    });

    it('an empty moment mid-navigation keeps the pre-hide until the new listing arrives', async () => {
      const { doc, life } = start();
      clickLink(doc, '/git/git/tree/master/contrib');
      // The old listing is gone and the new one has not rendered yet (observed live).
      const mid = loadHtmlFixture('folder');
      const holder = listing(mid);
      const parent = holder.parentElement;
      const next = holder.nextSibling;
      holder.remove();
      setPending(mid); // the real document keeps the attribute; the test replaced it
      expect(life.apply()).toBe('no-listing');
      expect(isPending(mid)).toBe(true); // still hidden: nothing may flash when it arrives
      parent?.insertBefore(holder, next); // React renders the folder listing
      await Promise.resolve();
      await nextFrame();
      await nextFrame();
      expect(toggles(mid).length).toBe(1);
      expect(isPending(mid)).toBe(false);
      expect(collapsed(mid)).toBe(true);
    });

    it('a cold load with no listing still clears pending at once', () => {
      const doc = loadHtmlFixture('root');
      listing(doc).remove();
      setPending(doc);
      expect(new CollapseController(ctx, doc).apply(new URL(fixtureUrl('root')))).toBe(
        'no-listing',
      );
      expect(isPending(doc)).toBe(false);
    });

    it('the cold-load watchdog does not end a navigation pre-hide armed after it (live flash)', () => {
      vi.useFakeTimers();
      const doc = loadHtmlFixture('root');
      const life = startLifecycle(ctx, doc); // arms the cold-load watchdog for t = 4 s
      life.apply();
      vi.advanceTimersByTime(3500);
      clickLink(doc, '/git/git/tree/master/contrib'); // a folder click just before 4 s
      expect(isPending(doc)).toBe(true);
      vi.advanceTimersByTime(600); // the cold-load watchdog fires
      expect(isPending(doc)).toBe(true); // still hiding: it belongs to the navigation now
      vi.advanceTimersByTime(WATCHDOG_MS); // the navigation's own watchdog ends it
      expect(isPending(doc)).toBe(false);
    });

    it('an apply on the OUTGOING page does not end the navigation pre-hide', () => {
      const { doc, life } = start();
      clickLink(doc, '/git/git/tree/master/contrib');
      expect(isPending(doc)).toBe(true);
      // A re-render of the old page before the URL changes (measured live on #16).
      expect(life.apply()).toBe('applied');
      expect(isPending(doc)).toBe(true);
    });

    it('a successful apply on the new listing clears the navigation pre-hide', () => {
      const { doc, life } = start();
      clickLink(doc, '/git/git/tree/master/contrib');
      const folder = loadHtmlFixture('folder');
      setPending(folder); // the document was replaced in the test; the real one keeps the attribute
      expect(life.apply()).toBe('applied');
      expect(isPending(folder)).toBe(false);
      expect(collapsed(folder)).toBe(true);
    });

    it('a redirected navigation: an apply on the real destination ends the pre-hide (agy, #17)', () => {
      // The link says main, GitHub lands on master: the toggle must work at once, not after 4 s.
      const { doc, life } = start();
      clickLink(doc, '/git/git/tree/main/contrib');
      expect(isPending(doc)).toBe(true);
      const folder = loadHtmlFixture('folder'); // https://github.com/git/git/tree/master/contrib
      setPending(folder);
      expect(life.apply()).toBe('applied');
      expect(isPending(folder)).toBe(false);
      expect(collapsed(folder)).toBe(true);
      // And the toggle works right away.
      query('gnrToggle', folder)?.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(collapsed(folder)).toBe(false);
    });
  });
});

describe('review findings on #16, round 4', () => {
  it('an exception after a collapse shows the files again (agy, blocking)', () => {
    const { doc, controller } = applied('root');
    expect(collapsed(doc)).toBe(true);
    const spy = vi.spyOn(doc.documentElement, 'setAttribute').mockImplementation(() => {
      throw new Error('boom');
    });
    // The next apply throws partway (React re-rendered the header away first).
    toggle(doc).remove();
    expect(controller.apply(new URL(fixtureUrl('root')))).toBe('error');
    spy.mockRestore();
    expect(collapsed(doc)).toBe(false);
    expect(toggles(doc).length).toBe(0);
  });

  it('a toggle-insertion failure does not mark the listing as installed (agy, blocking)', () => {
    vi.useFakeTimers();
    const doc = loadHtmlFixture('root');
    const life = startLifecycle(ctx, doc);
    const header = findHeaderLine(doc)?.insertionPoint;
    const spy = vi.spyOn(header as Element, 'prepend').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(life.apply()).toBe('error');
    spy.mockRestore();
    expect(life.controller.current?.installed).toBe(false);
    expect(collapsed(doc)).toBe(false);
  });

  it('outside a click/popstate navigation, a no-listing exit removes the marker (agy, blocking)', () => {
    const { doc, controller } = applied('root');
    expect(collapsed(doc)).toBe(true);
    // A keyboard-shortcut navigation (g c) or a React unmount: no pre-hide was armed.
    listing(doc).remove();
    expect(controller.apply(new URL(fixtureUrl('root')))).toBe('no-listing');
    expect(collapsed(doc)).toBe(false);
    expect(controller.current?.installed).toBe(false);
  });

  it('with the meta fallback gate, the no-listing exit observes the body (Codex)', async () => {
    const doc = loadHtmlFixture('root');
    query('codeView', doc)?.element.removeAttribute('app-name'); // the gate falls back to <meta>
    const held = listing(doc);
    const parent = held.parentElement;
    held.remove();
    const outcomes: string[] = [];
    const controller = new CollapseController(ctx, doc, () => {
      outcomes.push(controller.apply(new URL(fixtureUrl('root'))));
    });
    expect(controller.apply(new URL(fixtureUrl('root')))).toBe('no-listing');
    parent?.appendChild(held); // the listing arrives, no navigation signal follows
    await Promise.resolve();
    await nextFrame();
    expect(outcomes).toContain('applied');
    expect(toggles(doc).length).toBe(1);
  });

  it('a link differing only by a trailing slash or owner case is the same listing (agy)', () => {
    const { controller } = applied('root');
    expect(controller.navigationStarting(new URL('https://github.com/git/git/'))).toBe(false);
    expect(controller.navigationStarting(new URL('https://github.com/Git/GIT'))).toBe(false);
    expect(
      controller.navigationStarting(new URL('https://github.com/git/git/tree/master/contrib')),
    ).toBe(true);
  });

  it('teardown removes the id the extension gave the listing container (agy nit)', () => {
    const { doc } = applied('root');
    expect(listing(doc).id).toBe('gnr-listing');
    ctx.notifyInvalidated();
    expect(listing(doc).hasAttribute('id')).toBe(false);
  });
});
