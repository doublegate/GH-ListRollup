// GitHub DOM probe (no extension loaded): after a soft navigation between two listings with identical
// rows (/<o>/<r>/tree/main -> /<o>/<r>), does React keep the old listing container node or render a
// new one? The collapse controller's staleness check relies on a NEW node
// (ref-docs/research-update-2026-11-21-listing-node-identity.md). Re-run after GitHub router changes.
//
//   node node-identity.mjs
//
// Prints one line per visible link: whether the click was a soft navigation and whether the listing
// container is the same node as before.
import { chromium } from 'playwright';

const FROM = 'https://github.com/wxt-dev/wxt/tree/main';
const LINK = 'a[href="/wxt-dev/wxt"]';

const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true });
try {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(FROM, { waitUntil: 'networkidle' });
  const count = await page.locator(LINK).count();
  for (let i = 0; i < count; i++) {
    await page.goto(FROM, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      window.__alive = 1;
      const l = document.querySelector('[data-testid="directory-content"]');
      if (l) l.__probe = 1;
    });
    const link = page.locator(LINK).nth(i);
    if (!(await link.isVisible().catch(() => false))) {
      console.log(`link #${i}: not visible`);
      continue;
    }
    await link.click();
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const l = document.querySelector('[data-testid="directory-content"]');
      return {
        path: location.pathname,
        softNavigation: window.__alive === 1,
        sameNode: l?.__probe === 1,
        listing: Boolean(l),
      };
    });
    console.log(`link #${i}: ${JSON.stringify(r)}`);
  }
} finally {
  await ctx.close();
}
