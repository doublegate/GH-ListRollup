// Flash probe (maintainer live check on #16): samples every animation frame in the page and counts
// "flash" frames, where a listing is visible while no toggle says it is expanded. Covers a cold load
// and five rounds of (expand, folder click) and (expand, Back), the cases the maintainer saw flash.
//
//   node flash-probe.mjs <path to .output/chrome-mv3>      (exits 1 if any flash frame is seen)
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const EXT = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!EXT || !existsSync(join(EXT, 'manifest.json'))) {
  console.error(`usage: node ${process.argv[1]} <path to .output/chrome-mv3>`);
  process.exit(2);
}
let total = 0;
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
try {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.addInitScript(() => {
    window.__flash = [];
    window.__phase = 'cold';
    const tick = () => {
      const l = document.querySelector('[data-testid="directory-content"]');
      if (l && getComputedStyle(l).display !== 'none' && l.getClientRects().length) {
        const t = document.querySelector('[data-gnr="toggle"]');
        const ok = t && t.getAttribute('aria-expanded') === 'true';
        if (!ok)
          window.__flash.push(
            `${window.__phase} ${location.pathname} toggle=${t ? t.getAttribute('aria-expanded') : 'none'}`,
          );
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto('https://github.com/wxt-dev/wxt', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const report = async (label) => {
    const f = await page.evaluate(() => window.__flash.splice(0));
    total += f.length;
    console.log(
      `${label}: ${f.length} flash frame(s)${f.length ? ' -> ' + [...new Set(f)].join(' | ') : ''}`,
    );
  };
  await report('cold load');
  for (let i = 1; i <= 5; i++) {
    await page.evaluate(() => {
      window.__phase = 'folder-click';
    });
    await page.click('[data-gnr="toggle"]'); // expand (legit visible from here)
    await page.locator('a[href="/wxt-dev/wxt/tree/main/packages"]:visible').first().click();
    await page.waitForURL('**/tree/main/packages');
    await page.waitForTimeout(1500);
    await report(`  nav ${i} expand + folder click`);
    await page.evaluate(() => {
      window.__phase = 'back';
    });
    await page.click('[data-gnr="toggle"]'); // expand again, then Back
    await page.goBack();
    await page.waitForURL('https://github.com/wxt-dev/wxt');
    await page.waitForTimeout(1500);
    await report(`  nav ${i} expand + Back`);
  }
} finally {
  await ctx.close();
}
console.log(total === 0 ? 'PASS: no flash frames' : `FAIL: ${total} flash frame(s)`);
if (total > 0) process.exitCode = 1;
