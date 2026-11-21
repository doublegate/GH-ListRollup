// Diagnostic probe (Sprint 2, #16): on a cold load of a repository root, logs from the page every
// change to the listing container's class, to <html>'s data-gnr-pending and data-gnr-collapsed, and
// every insertion of the listing container or the extension's toggle, with timestamps.
//
// It found the cold-load flash: React re-inserts the listing container ~400 ms after the first apply,
// with class="", which is why the collapsed marker moved from the container to <html>.
//
//   node probe-class.mjs <path to .output/chrome-mv3>
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
  await page.addInitScript(() => {
    const t0 = performance.now();
    window.__log = [];
    const log = (m) => window.__log.push(`${(performance.now() - t0).toFixed(1)}ms ${m}`);
    new MutationObserver((recs) => {
      for (const r of recs) {
        const el = r.target;
        if (r.type === 'attributes' && el.getAttribute?.('data-testid') === 'directory-content')
          log(`listing class "${r.oldValue}" -> "${el.getAttribute('class')}"`);
        if (
          r.type === 'attributes' &&
          el === document.documentElement &&
          r.attributeName === 'data-gnr-pending'
        )
          log(`html pending ${el.hasAttribute('data-gnr-pending') ? 'SET' : 'cleared'}`);
        if (r.type === 'childList')
          for (const n of r.addedNodes) {
            if (n.nodeType === 1 && n.getAttribute('data-gnr') === 'toggle') log('toggle inserted');
            if (
              n.nodeType === 1 &&
              (n.getAttribute?.('data-testid') === 'directory-content' ||
                n.querySelector?.('[data-testid="directory-content"]'))
            )
              log('listing container (re)inserted');
          }
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['class', 'data-gnr-pending', 'data-gnr-collapsed'],
    });
  });
  await page.goto('https://github.com/wxt-dev/wxt', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  console.log((await page.evaluate(() => window.__log)).join('\n'));
} finally {
  await ctx.close();
}
