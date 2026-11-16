// T-GNR-004 Chrome verification: load the built extension into Playwright's bundled Chromium,
// drive live github.com (logged out), and record every [gnr] console line per step.
// A main-world marker on window proves that a navigation was soft (no full page load).
import { chromium } from 'playwright';

import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Fail fast on a missing or wrong path instead of an opaque Chromium launch (agy review, #2).
const EXT = process.argv[2];
if (!EXT || !existsSync(join(EXT, 'manifest.json'))) {
  console.error(`usage: node ${process.argv[1]} <path to .output/chrome-mv3>`);
  process.exit(2);
}
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

// Close the browser on every exit path, so a timeout against live github.com cannot leave a
// headless Chromium running (agy review, #2).
try {
  const lines = [];
  let step = 'init';
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on('console', (m) => {
    if (m.text().includes('[gnr]')) lines.push({ step, text: m.text() });
  });

  const settle = (ms = 2500) => page.waitForTimeout(ms);
  const mark = () => page.evaluate(() => (window.__gnrMarker = Math.random()));
  const marker = () => page.evaluate(() => window.__gnrMarker ?? null);
  const results = [];
  async function run(name, action) {
    step = name;
    const before = lines.length;
    const m = await mark();
    await action();
    await settle();
    const soft = (await marker()) === m;
    results.push({
      step: name,
      url: page.url(),
      softNav: soft,
      gnr: lines.slice(before).map((l) => l.text),
    });
  }

  await run('1 load repo root (full load)', async () => {
    await page.goto('https://github.com/wxt-dev/wxt', { waitUntil: 'domcontentloaded' });
  });
  await run('2 click folder "packages"', async () => {
    await page.locator('a[href="/wxt-dev/wxt/tree/main/packages"]:visible').first().click();
    await page.waitForURL('**/tree/main/packages');
  });
  await run('3 browser Back', async () => {
    await page.goBack();
    await page.waitForURL('https://github.com/wxt-dev/wxt');
  });
  await run('4 click Issues tab', async () => {
    await page.locator('a[href="/wxt-dev/wxt/issues"]:visible').first().click();
    await page.waitForURL('**/wxt-dev/wxt/issues**');
  });
  await run('5 click Code tab (back to root)', async () => {
    await page.locator('a[href="/wxt-dev/wxt"]:visible').first().click();
    await page.waitForURL('https://github.com/wxt-dev/wxt');
  });

  // Extension reload: the old content script must go quiet (ctx invalidated).
  let sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  await sw.evaluate(() => chrome.runtime.reload());
  await page.waitForTimeout(2000);
  await run('6 after extension reload: click folder "packages"', async () => {
    await page.locator('a[href="/wxt-dev/wxt/tree/main/packages"]:visible').first().click();
    await page.waitForURL('**/tree/main/packages');
  });
  await run('7 after extension reload: full page reload', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
  });
  await run('8 then click folder "packages/wxt"', async () => {
    await page.locator('a[href="/wxt-dev/wxt/tree/main/packages/wxt"]:visible').first().click();
    await page.waitForURL('**/tree/main/packages/wxt');
  });

  console.log(JSON.stringify(results, null, 2));

  // Expected outcomes for steps 1-6 (agy review, #2). Steps 7-8 are recorded only: Playwright's
  // Chromium does not re-inject the extension after chrome.runtime.reload(), a harness limit
  // (to-dos/phase-0-foundation/sprint-1-skeleton-ci.md, T-GNR-004).
  const expected = [
    { softNav: false, page: 'page repo-root wxt-dev/wxt path=/wxt-dev/wxt' },
    { softNav: true, page: 'page repo-tree wxt-dev/wxt path=/wxt-dev/wxt/tree/main/packages' },
    { softNav: true, page: 'page repo-root wxt-dev/wxt path=/wxt-dev/wxt' },
    { softNav: true, page: 'page other' },
    { softNav: true, page: 'page repo-root wxt-dev/wxt path=/wxt-dev/wxt' },
    { softNav: true, page: null }, // invalidated: the old content script must log no page line
  ];
  const failures = [];
  expected.forEach((want, i) => {
    const got = results[i];
    const pages = got.gnr.filter((t) => t.includes('[gnr] page'));
    if (got.softNav !== want.softNav) failures.push(`${got.step}: softNav ${got.softNav}`);
    if (
      want.page === null ? pages.length !== 0 : pages.length !== 1 || !pages[0].includes(want.page)
    )
      failures.push(`${got.step}: page lines ${JSON.stringify(pages)}`);
  });
  if (failures.length > 0) {
    console.error(`FAIL\n  ${failures.join('\n  ')}`);
    process.exitCode = 1;
  } else {
    console.error('PASS: steps 1-6 match the expected [gnr] output');
  }
} finally {
  await ctx.close();
}
