// Diagnostic probe (Sprint 2, #16): expands the listing on a repository root, clicks a folder, and
// prints a timestamped timeline from the page: the URL change, <html>'s data-gnr-pending and
// data-gnr-collapsed, listing and toggle insertions and removals, the extension's [gnr] console lines,
// and any frame where a listing is visible without its toggle saying "expanded".
//
// Note: observing every mutation shifts the timing, so a flash this probe does not show can still
// occur; flash-probe.mjs samples with less overhead. This probe is for explaining a sequence.
//
//   node probe-timeline.mjs <path to .output/chrome-mv3>
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const EXT = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!EXT || !existsSync(join(EXT, 'manifest.json'))) {
  console.error(`usage: node ${process.argv[1]} <path to .output/chrome-mv3>`);
  process.exit(2);
}
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
try {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on('console', (m) => {
    if (m.text().includes('[gnr]'))
      page.evaluate((t) => window.__mark?.(t), m.text()).catch(() => {});
  });
  await page.addInitScript(() => {
    let t0 = performance.now();
    window.__log = [];
    window.__on = false;
    window.__start = () => {
      t0 = performance.now();
      window.__log = [];
      window.__on = true;
    };
    const log = (m) => {
      if (window.__on)
        window.__log.push(`${(performance.now() - t0).toFixed(1).padStart(7)}ms ${m}`);
    };
    window.__mark = (t) => log(`  console: ${t.replace('[gnr] ', '').slice(0, 90)}`);
    let lastPath = location.pathname;
    new MutationObserver((recs) => {
      if (location.pathname !== lastPath) {
        log(`URL -> ${location.pathname}`);
        lastPath = location.pathname;
      }
      for (const r of recs) {
        if (r.type === 'attributes' && r.target === document.documentElement)
          log(
            `html ${r.attributeName} ${document.documentElement.hasAttribute(r.attributeName) ? 'SET' : 'removed'}`,
          );
        if (r.type === 'childList') {
          for (const n of r.addedNodes)
            if (n.nodeType === 1) {
              if (n.matches?.('[data-gnr="toggle"]') || n.querySelector?.('[data-gnr="toggle"]'))
                log('toggle inserted');
              if (
                n.matches?.('[data-testid="directory-content"]') ||
                n.querySelector?.('[data-testid="directory-content"]')
              )
                log('listing inserted');
            }
          for (const n of r.removedNodes)
            if (n.nodeType === 1) {
              // An ancestor removed by React (hydration, soft navigation) takes the toggle with it.
              if (n.matches?.('[data-gnr="toggle"]') || n.querySelector?.('[data-gnr="toggle"]'))
                log('toggle removed');
              if (
                n.matches?.('[data-testid="directory-content"]') ||
                n.querySelector?.('[data-testid="directory-content"]')
              )
                log('listing removed');
            }
        }
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-gnr-pending', 'data-gnr-collapsed'],
    });
    const tick = () => {
      if (window.__on) {
        const l = document.querySelector('[data-testid="directory-content"]');
        const vis = l && getComputedStyle(l).display !== 'none' && l.getClientRects().length;
        const t = document.querySelector('[data-gnr="toggle"]');
        if (vis && !(t && t.getAttribute('aria-expanded') === 'true'))
          log(
            `*** FLASH frame: listing visible, toggle=${t ? t.getAttribute('aria-expanded') : 'none'}`,
          );
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto('https://github.com/wxt-dev/wxt', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.click('[data-gnr="toggle"]');
  await page.evaluate(() => window.__start());
  await page.locator('a[href="/wxt-dev/wxt/tree/main/packages"]:visible').first().click();
  await page.waitForURL('**/tree/main/packages');
  await page.waitForTimeout(1500);
  console.log((await page.evaluate(() => window.__log)).join('\n'));
} finally {
  await ctx.close();
}
